import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ClaraSsoController } from "./clara-sso/clara-sso.controller";
import { ClaraSsoService } from "./clara-sso/clara-sso.service";
import { ClaraSsoConfigService } from "./clara-sso/clara-sso.config";
import { ClaraSsoStateService } from "./clara-sso/clara-sso-state.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, ClaraSsoController],
  providers: [AuthService, ClaraSsoService, ClaraSsoConfigService, ClaraSsoStateService],
  exports: [AuthService],
})
export class AuthModule {}
