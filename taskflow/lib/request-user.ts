import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { extractBearerToken, verifyToken } from "@/lib/auth";

export const getRequestUser = async () => {
  const headerStore = await headers();
  const token = extractBearerToken(headerStore.get("authorization"));
  if (!token) {
    return null;
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        avatar: true,
        color: true,
      },
    });

    return user;
  } catch {
    return null;
  }
};
