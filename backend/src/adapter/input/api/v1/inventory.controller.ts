import { Controller, Get, Post, Put, Delete, Body, Param, Query, Patch, Req } from '@nestjs/common';
import { PrismaService } from '../../../../../core/db/psql/prisma.client';
import { confirmPassword } from '../../../../../core/utils/password-confirm';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryServiceImpl } from '../../../../application/services/inventory.service.impl';
import { Roles } from '../../../../modules/decorators/roles.decorator';
import { RequiresModule } from '../../../../modules/decorators/requires-module.decorator';
import { ZodValidationPipe } from '../../../../modules/pipes/zod-validation.pipe';
import { CreateInventoryItemSchema, UpdateInventoryItemSchema, CreateInventoryItemDTO, UpdateInventoryItemDTO } from '@easy-books/shared';

@ApiTags('Inventory')
@ApiBearerAuth()
@RequiresModule('INVENTORY_STOCK')
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(
    private readonly service: InventoryServiceImpl,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get all inventory items' })
  @ApiQuery({ name: 'companyId', required: true })
  findAll(@Query('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  @Roles('STAFF', 'ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get an inventory item by id' })
  @ApiQuery({ name: 'companyId', required: true })
  findOne(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Create an inventory item' })
  create(@Body(new ZodValidationPipe(CreateInventoryItemSchema)) dto: CreateInventoryItemDTO) {
    return this.service.create(dto);
  }

  // Editing an item (prices, expiry…) needs the user's password, checked
  // here — the Inventory page's password prompt used to check nothing.
  @Put(':id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Update an inventory item (body must include the current user\'s password)' })
  @ApiQuery({ name: 'companyId', required: true })
  async update(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateInventoryItemSchema)) dto: UpdateInventoryItemDTO,
    @Body('password') password: string,
    @Req() req: any,
  ) {
    await confirmPassword(this.prisma, req.user.sub, password);
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Delete an inventory item' })
  @ApiQuery({ name: 'companyId', required: true })
  remove(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.remove(id, companyId);
  }

  @Patch(':id/adjust')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Record a stock adjustment (ADDITION | SUBTRACTION | RECOUNT)' })
  @ApiQuery({ name: 'companyId', required: true })
  adjust(
    @Param('id') id: string,
    @Query('companyId') companyId: string,
    @Body() body: { adjustmentType: 'ADDITION' | 'SUBTRACTION' | 'RECOUNT'; quantityChange: number; reason?: string; adjustedBy?: string },
  ) {
    return this.service.adjust(id, companyId, body);
  }

  @Get(':id/adjustments')
  @Roles('ACCOUNTANT', 'ADMIN')
  @ApiOperation({ summary: 'Get adjustment log for an inventory item' })
  @ApiQuery({ name: 'companyId', required: true })
  getAdjustments(@Param('id') id: string, @Query('companyId') companyId: string) {
    return this.service.getAdjustments(id, companyId);
  }
}
