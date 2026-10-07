import { SetMetadata } from '@nestjs/common';
import { ModuleKey } from '../../../core/modules/module-keys';

export const REQUIRES_MODULE_KEY = 'requiresModule';
export const RequiresModule = (module: ModuleKey) => SetMetadata(REQUIRES_MODULE_KEY, module);
