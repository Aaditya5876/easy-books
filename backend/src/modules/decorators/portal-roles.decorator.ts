import { SetMetadata } from '@nestjs/common';
import { PortalUserType } from '@prisma/client';

export const PORTAL_ROLES_KEY = 'portalRoles';
export const PortalRoles = (...roles: PortalUserType[]) => SetMetadata(PORTAL_ROLES_KEY, roles);
