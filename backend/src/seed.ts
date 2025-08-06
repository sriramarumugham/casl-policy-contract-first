import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.post.deleteMany();
  await prisma.userPolicies.deleteMany();
  await prisma.user.deleteMany();

  const user1 = await prisma.user.create({
    data: {
      name: "Alice",
      email: "alice@example.com",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: "Bob",
      email: "bob@example.com",
    },
  });

  await prisma.post.createMany({
    data: [
      {
        title: "First Post",
        content: "This is the first post content",
        authorId: user1.id,
      },
      {
        title: "Second Post",
        content: "This is the second post content",
        authorId: user2.id,
      },
      {
        title: "Third Post",
        content: "This is the third post content",
        authorId: user1.id,
      },
    ],
  });

  console.log("Database seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });