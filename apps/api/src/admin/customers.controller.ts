import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Permission, type JwtAccessPayload } from "@solidchat/shared";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundApiException } from "../common/errors/api.exception";
import { ErrorCode } from "@solidchat/shared";

@ApiTags("admin-customers")
@UseGuards(PermissionsGuard)
@RequirePermissions(Permission.CUSTOMER_VIEW)
@Controller("api/v1/admin/customers")
export class CustomersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: JwtAccessPayload, @Query("search") search?: string) {
    const sites = await this.prisma.site.findMany({ where: { organizationId: user.organizationId }, select: { id: true } });
    const siteIds = sites.map((s) => s.id);
    const customers = await this.prisma.customer.findMany({
      where: {
        siteId: { in: siteIds },
        ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { success: true, data: customers };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { conversations: { orderBy: { createdAt: "desc" }, take: 20 }, tags: { include: { tag: true } }, tickets: true },
    });
    if (!customer) throw new NotFoundApiException(ErrorCode.NOT_FOUND, "Customer tidak ditemukan.");
    return { success: true, data: customer };
  }
}
