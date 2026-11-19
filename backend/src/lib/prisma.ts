import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as any;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function safeQuery<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (
      err.message?.includes("Closed") ||
      err.message?.includes("Connection")
    ) {
      console.log("⚠️ Reconnecting DB...");
      await prisma.$disconnect();
      await prisma.$connect();
      return await fn();
    }
    throw err;
  }
}