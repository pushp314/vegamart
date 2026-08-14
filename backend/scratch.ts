import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const role = await prisma.role.findUnique({ where: { slug: 'admin' }, include: { role_permissions: { include: { permission: true } } } });
  const slugs = role?.role_permissions.map(rp => rp.permission.slug);
  console.log("Admin permissions:", slugs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
