import { Global, Module } from "@nestjs/common";
import { AuditLogService } from "./audit/audit-log.service";
import { SecurityEventService } from "./security/security-event.service";
import { EncryptionService } from "./security/encryption.service";

@Global()
@Module({
  providers: [AuditLogService, SecurityEventService, EncryptionService],
  exports: [AuditLogService, SecurityEventService, EncryptionService],
})
export class CommonModule {}
