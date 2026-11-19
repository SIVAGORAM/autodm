import { prisma } from './src/lib/prisma';

async function check() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, isVerified: true }
  });
  console.log(users);
}

check();
