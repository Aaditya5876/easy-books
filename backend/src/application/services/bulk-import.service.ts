import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../core/db/psql/prisma.client';

export interface BulkResult {
  created: number;
  skipped: Array<{ row: number; reason: string }>;
}

const num = (v: any): number => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

const int = (v: any, fallback: number): number => {
  const n = parseInt(String(v ?? ''), 10);
  return isNaN(n) || n < 0 ? fallback : n;
};

const dateOrNull = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

const str = (v: any): string | undefined => {
  const s = String(v ?? '').trim();
  return s || undefined;
};

@Injectable()
export class BulkImportService {
  constructor(private readonly prisma: PrismaService) {}

  async import(entity: string, companyId: string, rows: any[]): Promise<BulkResult> {
    if (!companyId) throw new BadRequestException('companyId is required');
    if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestException('rows must be a non-empty array');
    if (rows.length > 2000) throw new BadRequestException('Maximum 2000 rows per import');

    switch (entity) {
      case 'students': return this.importStudents(companyId, rows);
      case 'subjects': return this.importSubjects(companyId, rows);
      case 'books': return this.importBooks(companyId, rows);
      case 'employees': return this.importEmployees(companyId, rows);
      case 'clients': return this.importClients(companyId, rows);
      case 'vendors': return this.importVendors(companyId, rows);
      case 'inventory': return this.importInventory(companyId, rows);
      default: throw new BadRequestException(`Unknown import entity: ${entity}`);
    }
  }

  // ── Students — resolves "class" + "section" columns, auto-creating classes ──

  private async importStudents(companyId: string, rows: any[]): Promise<BulkResult> {
    const skipped: BulkResult['skipped'] = [];

    const classes = await this.prisma.schoolClass.findMany({ where: { companyId } });
    const classKey = (name: string, section?: string | null) =>
      `${name.trim().toLowerCase()}|${(section || '').trim().toLowerCase()}`;
    const classMap = new Map(classes.map(c => [classKey(c.name, c.section), c.id]));

    // Auto-create classes referenced in the sheet but missing in the system
    for (const row of rows) {
      const className = str(row.class);
      if (!className) continue;
      const section = str(row.section);
      const key = classKey(className, section);
      if (!classMap.has(key)) {
        const created = await this.prisma.schoolClass.create({
          data: { companyId, name: className, section: section ?? null },
        });
        classMap.set(key, created.id);
      }
    }

    const existing = await this.prisma.student.findMany({
      where: { companyId, rollNumber: { not: null } },
      select: { rollNumber: true },
    });
    const seenRolls = new Set(existing.map(s => s.rollNumber));

    const data: any[] = [];
    rows.forEach((row, i) => {
      const name = str(row.name);
      if (!name) return skipped.push({ row: i + 1, reason: 'Name is required' });

      const rollNumber = str(row.rollNumber) ?? null;
      if (rollNumber) {
        if (seenRolls.has(rollNumber)) {
          return skipped.push({ row: i + 1, reason: `Duplicate roll number "${rollNumber}"` });
        }
        seenRolls.add(rollNumber);
      }

      const className = str(row.class);
      const classId = className ? classMap.get(classKey(className, str(row.section))) ?? null : null;

      data.push({
        companyId,
        name,
        rollNumber,
        classId,
        gender: str(row.gender) ?? null,
        guardianName: str(row.guardianName) ?? null,
        guardianPhone: str(row.guardianPhone) ?? null,
        guardianEmail: str(row.guardianEmail) ?? null,
        address: str(row.address) ?? null,
        dateOfBirth: dateOrNull(row.dateOfBirth),
      });
    });

    const result = await this.prisma.student.createMany({ data });
    return { created: result.count, skipped };
  }

  // ── Subjects ─────────────────────────────────────────────────────────────────

  private async importSubjects(companyId: string, rows: any[]): Promise<BulkResult> {
    const skipped: BulkResult['skipped'] = [];
    const existing = await this.prisma.subject.findMany({ where: { companyId }, select: { name: true } });
    const seen = new Set(existing.map(s => s.name.toLowerCase()));

    const data: any[] = [];
    rows.forEach((row, i) => {
      const name = str(row.name);
      if (!name) return skipped.push({ row: i + 1, reason: 'Name is required' });
      if (seen.has(name.toLowerCase())) {
        return skipped.push({ row: i + 1, reason: `Subject "${name}" already exists` });
      }
      seen.add(name.toLowerCase());
      data.push({ companyId, name, code: str(row.code) ?? null });
    });

    const result = await this.prisma.subject.createMany({ data });
    return { created: result.count, skipped };
  }

  // ── Library books ────────────────────────────────────────────────────────────

  private async importBooks(companyId: string, rows: any[]): Promise<BulkResult> {
    const skipped: BulkResult['skipped'] = [];
    const data: any[] = [];
    rows.forEach((row, i) => {
      const title = str(row.title);
      if (!title) return skipped.push({ row: i + 1, reason: 'Title is required' });
      const totalCopies = int(row.totalCopies, 1);
      data.push({
        companyId,
        title,
        author: str(row.author) ?? null,
        isbn: str(row.isbn) ?? null,
        category: str(row.category) ?? null,
        totalCopies,
        availableCopies: totalCopies,
        shelfLocation: str(row.shelfLocation) ?? null,
      });
    });

    const result = await this.prisma.book.createMany({ data });
    return { created: result.count, skipped };
  }

  // ── Employees / Teachers ─────────────────────────────────────────────────────

  private async importEmployees(companyId: string, rows: any[]): Promise<BulkResult> {
    const skipped: BulkResult['skipped'] = [];
    const existing = await this.prisma.employee.findMany({ where: { companyId }, select: { employeeId: true } });
    const seen = new Set(existing.map(e => e.employeeId));

    // Auto-generate EMP-<n> ids for rows without one
    let nextSeq = existing.length + 1;
    const nextId = () => {
      let id = `EMP-${String(nextSeq).padStart(3, '0')}`;
      while (seen.has(id)) { nextSeq++; id = `EMP-${String(nextSeq).padStart(3, '0')}`; }
      nextSeq++;
      return id;
    };

    const data: any[] = [];
    rows.forEach((row, i) => {
      const name = str(row.name);
      if (!name) return skipped.push({ row: i + 1, reason: 'Name is required' });

      let employeeId = str(row.employeeId);
      if (employeeId && seen.has(employeeId)) {
        return skipped.push({ row: i + 1, reason: `Duplicate employee ID "${employeeId}"` });
      }
      if (!employeeId) employeeId = nextId();
      seen.add(employeeId);

      data.push({
        companyId,
        name,
        employeeId,
        department: str(row.department) ?? null,
        designation: str(row.designation) ?? null,
        phone: str(row.phone) ?? null,
        email: str(row.email) ?? null,
        address: str(row.address) ?? null,
        panNumber: str(row.panNumber) ?? null,
        dateOfJoining: dateOrNull(row.dateOfJoining),
        basicSalary: num(row.basicSalary),
      });
    });

    const result = await this.prisma.employee.createMany({ data });
    return { created: result.count, skipped };
  }

  // ── Clients / Vendors ────────────────────────────────────────────────────────

  private async importClients(companyId: string, rows: any[]): Promise<BulkResult> {
    return this.importParty('client', companyId, rows);
  }

  private async importVendors(companyId: string, rows: any[]): Promise<BulkResult> {
    return this.importParty('vendor', companyId, rows);
  }

  private async importParty(kind: 'client' | 'vendor', companyId: string, rows: any[]): Promise<BulkResult> {
    const skipped: BulkResult['skipped'] = [];
    const data: any[] = [];
    rows.forEach((row, i) => {
      const name = str(row.name);
      if (!name) return skipped.push({ row: i + 1, reason: 'Name is required' });
      data.push({
        companyId,
        name,
        contactPerson: str(row.contactPerson) ?? null,
        email: str(row.email) ?? null,
        phone: str(row.phone) ?? null,
        address: str(row.address) ?? null,
        panVat: str(row.panVat) ?? null,
        notes: str(row.notes) ?? null,
      });
    });

    const result = kind === 'client'
      ? await this.prisma.client.createMany({ data })
      : await this.prisma.vendor.createMany({ data });
    return { created: result.count, skipped };
  }

  // ── Inventory items ──────────────────────────────────────────────────────────

  private async importInventory(companyId: string, rows: any[]): Promise<BulkResult> {
    const skipped: BulkResult['skipped'] = [];
    const data: any[] = [];
    rows.forEach((row, i) => {
      const itemName = str(row.itemName);
      if (!itemName) return skipped.push({ row: i + 1, reason: 'Item name is required' });
      data.push({
        companyId,
        itemName,
        partNumber: str(row.partNumber) ?? null,
        brand: str(row.brand) ?? null,
        description: str(row.description) ?? null,
        unit: str(row.unit) ?? 'PCS',
        quantity: num(row.quantity),
        unitPurchasePrice: num(row.unitPurchasePrice),
        unitSellingPrice: num(row.unitSellingPrice),
        stockLocation: str(row.stockLocation) ?? null,
        lowStockThreshold: num(row.lowStockThreshold),
      });
    });

    const result = await this.prisma.inventoryItem.createMany({ data });
    return { created: result.count, skipped };
  }
}
