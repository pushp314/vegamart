import prisma from "../database/prisma";

export async function findBySlug(slug: string) {
  return prisma.role.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
}

export async function findById(id: string) {
  return prisma.role.findUnique({ where: { id } });
}

export async function createRole(data: { name: string; slug: string; description?: string }) {
  return prisma.role.create({ data });
}
