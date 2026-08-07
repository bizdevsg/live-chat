import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { TeamsController } from "./teams.controller";
import { TeamsService } from "./teams.service";
import { SitesController } from "./sites.controller";
import { SitesService } from "./sites.service";
import { RulesController } from "./rules.controller";
import { OverviewController } from "./overview.controller";
import { CustomersController } from "./customers.controller";

@Module({
  controllers: [UsersController, TeamsController, SitesController, RulesController, OverviewController, CustomersController],
  providers: [UsersService, TeamsService, SitesService],
})
export class AdminModule {}
