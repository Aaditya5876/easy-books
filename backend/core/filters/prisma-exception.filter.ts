import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Turns database errors that reach a controller into the 4xx a form can show
// ("Name is required", "…already exists") instead of a generic 500. Services
// still validate what they can; this is the net under every create/update.
const label = (field: string) => {
  const words = field.replace(/Id$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export function prismaErrorToHttp(err: unknown): { status: number; message: string } | null {
  if (err instanceof Prisma.PrismaClientValidationError) {
    const msg = err.message;
    const missing = msg.match(/Argument `(\w+)` is missing/);
    if (missing) return { status: HttpStatus.BAD_REQUEST, message: `${label(missing[1])} is required` };
    const invalid = msg.match(/(?:Invalid value for argument|Argument) `(\w+)`/);
    if (invalid) return { status: HttpStatus.BAD_REQUEST, message: `Invalid value for ${label(invalid[1]).toLowerCase()}` };
    return { status: HttpStatus.BAD_REQUEST, message: 'Some fields are missing or invalid' };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string | undefined) ?? [];
        const fields = (Array.isArray(target) ? target : [target]).filter((f) => f !== 'companyId').map((f) => label(f).toLowerCase());
        return { status: HttpStatus.CONFLICT, message: fields.length ? `A record with this ${fields.join(' and ')} already exists` : 'This record already exists' };
      }
      case 'P2025':
        return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
      case 'P2003':
        return { status: HttpStatus.BAD_REQUEST, message: 'A linked record (class, student, account…) was not found' };
      case 'P2000':
        return { status: HttpStatus.BAD_REQUEST, message: 'A value is too long' };
      case 'P2007':
      case 'P2006':
        return { status: HttpStatus.BAD_REQUEST, message: 'Some fields have invalid values' };
    }
  }
  return null;
}

@Catch(Prisma.PrismaClientValidationError, Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const mapped = prismaErrorToHttp(err);
    if (!mapped) {
      console.error(err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
    }
    res.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
  }
}
