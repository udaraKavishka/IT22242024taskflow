import { NextRequest } from "next/server";

import { comparePassword, extractBearerToken, hashPassword, signToken, verifyToken } from "@/lib/auth";
import { randomColor } from "@/lib/colors";
import { fail, ok } from "@/lib/http";
import { toLegacyBoard, toLegacyCard, toLegacyList } from "@/lib/legacy-serializers";
import { prisma } from "@/lib/prisma";
import { serializeUserWithBoards } from "@/lib/user-serializer";

const getAuthUser = async (request: NextRequest) => {
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return null;
  }

  try {
    const payload = verifyToken(token);
    return prisma.user.findUnique({ where: { id: payload.id } });
  } catch {
    return null;
  }
};

const ensureBoardMember = async (userId: string, boardId: string) => {
  const membership = await prisma.userBoard.findUnique({
    where: {
      userId_boardId: {
        userId,
        boardId,
      },
    },
  });

  return Boolean(membership);
};

const getBoardWithRelations = async (boardId: string) => {
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      lists: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: {
              labels: true,
              members: true,
              attachments: true,
              activities: {
                orderBy: { createdAt: "desc" },
              },
              checklists: {
                include: {
                  items: true,
                },
              },
              date: true,
              cover: true,
            },
          },
        },
      },
      activity: {
        orderBy: { createdAt: "desc" },
      },
      members: {
        include: {
          user: true,
        },
      },
    },
  });
};

const getListPayload = async (listId: string, boardId: string) => {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: {
      cards: {
        orderBy: { position: "asc" },
        include: {
          labels: true,
          members: true,
          attachments: true,
          activities: true,
          checklists: { include: { items: true } },
          date: true,
          cover: true,
        },
      },
    },
  });

  if (!list) return null;
  return toLegacyList(list, boardId);
};

const getCardPayload = async (cardId: string, boardId: string, listTitle = "") => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      labels: true,
      members: true,
      attachments: true,
      activities: {
        orderBy: { createdAt: "desc" },
      },
      checklists: { include: { items: true } },
      date: true,
      cover: true,
    },
  });

  if (!card) return null;
  return toLegacyCard(card, boardId, listTitle);
};

const parseBody = async (request: NextRequest) => {
  try {
    return await request.json();
  } catch {
    return {};
  }
};

const listIncludes = {
  cards: {
    orderBy: { position: "asc" as const },
    include: {
      labels: true,
      members: true,
      attachments: true,
      activities: true,
      checklists: { include: { items: true } },
      date: true,
      cover: true,
    },
  },
};

const handleUser = async (request: NextRequest, method: string, parts: string[]) => {
  if (method === "POST" && parts[0] === "register") {
    const body = await parseBody(request);
    const { name, surname, email, password } = body;
    if (!name || !surname || !email || !password) {
      return fail("All fields are required", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return fail("There is already a user with this email", 400);
    }

    const hashed = await hashPassword(password);
    await prisma.user.create({
      data: {
        name,
        surname,
        email,
        password: hashed,
        color: randomColor(),
      },
    });

    return ok({ message: "User created Successfully!" });
  }

  if (method === "POST" && parts[0] === "login") {
    const body = await parseBody(request);
    const { email, password } = body;
    if (!email || !password) {
      return fail("Email and password are required", 400, { message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        boards: {
          include: {
            board: true,
          },
        },
      },
    });
    if (!user) {
      return fail("Invalid credentials", 401, { message: "Invalid credentials" });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return fail("Invalid credentials", 401, { message: "Invalid credentials" });
    }

    const token = signToken({ id: user.id, email: user.email });
    return ok({
      message: "User logged in successfully",
      user: serializeUserWithBoards(user, token),
    });
  }

  const authUser = await getAuthUser(request);
  if (!authUser) {
    return fail("Unauthorized", 401);
  }

  if (method === "GET" && parts[0] === "get-user") {
    if (parts[1]) {
      const user = await prisma.user.findUnique({
        where: { id: parts[1] },
        include: { boards: { include: { board: true } } },
      });
      if (!user) return fail("User not found", 404);
      return ok(serializeUserWithBoards(user));
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: { boards: { include: { board: true } } },
    });
    if (!user) return fail("User not found", 404);
    return ok(serializeUserWithBoards(user));
  }

  if (method === "POST" && parts[0] === "get-user-with-email") {
    const body = await parseBody(request);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return fail("User not found", 404);
    return ok({
      _id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      color: user.color,
      avatar: user.avatar,
    });
  }

  return fail("Not found", 404);
};

const handleBoard = async (request: NextRequest, method: string, parts: string[]) => {
  const authUser = await getAuthUser(request);
  if (!authUser) return fail("Unauthorized", 401);

  if (method === "POST" && parts[0] === "create") {
    const body = await parseBody(request);
    const title = body.title?.trim();
    const backgroundImageLink = body.backgroundImageLink;
    const members = Array.isArray(body.members) ? body.members : [];
    if (!title || !backgroundImageLink) {
      return fail("Title and background are required", 400);
    }

    const board = await prisma.board.create({
      data: {
        title,
        backgroundImageLink,
        isImage: true,
        members: {
          create: [{ userId: authUser.id, role: "owner" }],
        },
        activity: {
          create: {
            userId: authUser.id,
            name: authUser.name,
            action: "created this board",
            color: authUser.color,
          },
        },
      },
    });

    for (const member of members) {
      const memberId = member._id || member.user || member.id;
      if (!memberId || memberId === authUser.id) continue;
      await prisma.userBoard.upsert({
        where: { userId_boardId: { userId: memberId, boardId: board.id } },
        update: {},
        create: { userId: memberId, boardId: board.id, role: "member" },
      });
    }

    const created = await getBoardWithRelations(board.id);
    if (!created) return fail("Board create failed", 500);
    return ok(toLegacyBoard(created));
  }

  if (method === "GET" && parts.length === 0) {
    const links = await prisma.userBoard.findMany({
      where: { userId: authUser.id },
      include: { board: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(
      links.map((entry) => ({
        _id: entry.board.id,
        title: entry.board.title,
        isImage: entry.board.isImage,
        backgroundImageLink: entry.board.backgroundImageLink,
        description: entry.board.description,
      }))
    );
  }

  const boardId = parts[0];
  if (!boardId) return fail("Not found", 404);
  const isMember = await ensureBoardMember(authUser.id, boardId);
  if (!isMember) return fail("Forbidden", 403);

  if (method === "GET" && parts.length === 1) {
    const board = await getBoardWithRelations(boardId);
    if (!board) return fail("Board not found", 404);
    return ok(toLegacyBoard(board));
  }

  if (method === "GET" && parts[1] === "activity") {
    const activity = await prisma.boardActivity.findMany({
      where: { boardId },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      activity.map((item) => ({
        _id: item.id,
        user: item.userId,
        name: item.name,
        action: item.action,
        date: item.createdAt,
        edited: item.edited,
        cardTitle: item.cardTitle,
        actionType: item.actionType,
        color: item.color,
      }))
    );
  }

  if (method === "DELETE" && parts.length === 1) {
    await prisma.board.delete({ where: { id: boardId } });
    return ok({ message: "Board deleted" });
  }

  if (method === "POST" && parts[1] === "add-member") {
    const body = await parseBody(request);
    const members = Array.isArray(body.members) ? body.members : [];
    for (const member of members) {
      const memberId = member._id || member.user || member.id;
      if (!memberId) continue;
      await prisma.userBoard.upsert({
        where: { userId_boardId: { userId: memberId, boardId } },
        update: {},
        create: { userId: memberId, boardId, role: "member" },
      });
    }

    const updated = await prisma.userBoard.findMany({
      where: { boardId },
      include: { user: true },
    });

    return ok(
      updated.map((entry) => ({
        user: entry.userId,
        name: entry.user.name,
        surname: entry.user.surname,
        email: entry.user.email,
        role: entry.role,
        color: entry.user.color,
      }))
    );
  }

  if (method === "PUT" && parts[1] === "update-background") {
    const body = await parseBody(request);
    await prisma.board.update({
      where: { id: boardId },
      data: {
        backgroundImageLink: body.background,
        isImage: Boolean(body.isImage),
      },
    });
    return ok({ message: "Board background updated" });
  }

  if (method === "PUT" && parts[1] === "update-board-description") {
    const body = await parseBody(request);
    await prisma.board.update({
      where: { id: boardId },
      data: { description: body.description ?? "" },
    });
    return ok({ message: "Board description updated" });
  }

  if (method === "PUT" && parts[1] === "update-board-title") {
    const body = await parseBody(request);
    await prisma.board.update({
      where: { id: boardId },
      data: { title: body.title ?? "" },
    });
    return ok({ message: "Board title updated" });
  }

  return fail("Not found", 404);
};

const handleList = async (request: NextRequest, method: string, parts: string[]) => {
  const authUser = await getAuthUser(request);
  if (!authUser) return fail("Unauthorized", 401);

  if (method === "POST" && parts[0] === "create") {
    const body = await parseBody(request);
    const boardId = body.boardId;
    if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);
    const max = await prisma.list.aggregate({
      where: { boardId },
      _max: { position: true },
    });
    const list = await prisma.list.create({
      data: {
        title: body.title,
        boardId,
        position: (max._max.position ?? -1) + 1,
      },
      include: listIncludes,
    });
    return ok(toLegacyList(list, boardId));
  }

  if (method === "GET" && parts.length === 1) {
    const boardId = parts[0];
    if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);
    const lists = await prisma.list.findMany({
      where: { boardId },
      orderBy: { position: "asc" },
      include: listIncludes,
    });

    return ok(lists.map((list) => toLegacyList(list, boardId)));
  }

  if (method === "DELETE" && parts.length === 2) {
    const [boardId, listId] = parts;
    if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);
    await prisma.list.delete({ where: { id: listId } });
    return ok({ message: "List deleted" });
  }

  if (method === "PUT" && parts.length === 3 && parts[2] === "update-title") {
    const [boardId, listId] = parts;
    if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);
    const body = await parseBody(request);
    await prisma.list.update({ where: { id: listId }, data: { title: body.title ?? "" } });
    return ok({ message: "List title updated" });
  }

  if (method === "POST" && parts[0] === "change-card-order") {
    const body = await parseBody(request);
    const { boardId, sourceId, destinationId, destinationIndex, cardId } = body;
    if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);

    await prisma.$transaction(async (tx) => {
      const sourceList = await tx.list.findUnique({
        where: { id: sourceId },
        include: { cards: { orderBy: { position: "asc" } } },
      });
      const destinationList = await tx.list.findUnique({
        where: { id: destinationId },
        include: { cards: { orderBy: { position: "asc" } } },
      });
      if (!sourceList || !destinationList) return;

      const moving = sourceList.cards.find((card) => card.id === cardId);
      if (!moving) return;

      const sourceCards = sourceList.cards.filter((card) => card.id !== cardId);

      if (sourceId === destinationId) {
        sourceCards.splice(destinationIndex, 0, moving);
        for (let i = 0; i < sourceCards.length; i += 1) {
          await tx.card.update({ where: { id: sourceCards[i].id }, data: { position: i } });
        }
      } else {
        for (let i = 0; i < sourceCards.length; i += 1) {
          await tx.card.update({ where: { id: sourceCards[i].id }, data: { position: i } });
        }

        const destinationCards = [...destinationList.cards];
        destinationCards.splice(destinationIndex, 0, moving);
        for (let i = 0; i < destinationCards.length; i += 1) {
          await tx.card.update({
            where: { id: destinationCards[i].id },
            data: {
              position: i,
              listId: destinationId,
            },
          });
        }
      }
    });

    return ok({ message: "Card order updated" });
  }

  if (method === "POST" && parts[0] === "change-list-order") {
    const body = await parseBody(request);
    const { boardId, destinationIndex, listId } = body;
    if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);

    const lists = await prisma.list.findMany({ where: { boardId }, orderBy: { position: "asc" } });
    const current = lists.find((list) => list.id === listId);
    if (!current) return fail("List not found", 404);
    const reordered = lists.filter((list) => list.id !== listId);
    const to = Math.max(0, Math.min(destinationIndex, reordered.length));
    reordered.splice(to, 0, current);

    for (let i = 0; i < reordered.length; i += 1) {
      await prisma.list.update({ where: { id: reordered[i].id }, data: { position: i } });
    }

    return ok({ message: "List order updated" });
  }

  return fail("Not found", 404);
};

const handleCard = async (request: NextRequest, method: string, parts: string[]) => {
  const authUser = await getAuthUser(request);
  if (!authUser) return fail("Unauthorized", 401);

  if (method === "POST" && parts[0] === "create") {
    const body = await parseBody(request);
    const { boardId, listId, title } = body;
    if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);

    const max = await prisma.card.aggregate({ where: { listId }, _max: { position: true } });
    await prisma.card.create({
      data: {
        listId,
        title,
        position: (max._max.position ?? -1) + 1,
      },
    });

    const updatedList = await getListPayload(listId, boardId);
    return ok(updatedList);
  }

  const [boardId, listId, cardId] = parts;
  if (!(boardId && listId && cardId)) return fail("Not found", 404);
  if (!(await ensureBoardMember(authUser.id, boardId))) return fail("Forbidden", 403);

  if (method === "GET" && parts.length === 3) {
    const list = await prisma.list.findUnique({ where: { id: listId } });
    const card = await getCardPayload(cardId, boardId, list?.title ?? "");
    if (!card) return fail("Card not found", 404);
    return ok(card);
  }

  if (method === "PUT" && parts.length === 3) {
    const body = await parseBody(request);
    await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
      },
    });
    return ok({ message: "Card updated" });
  }

  if (method === "DELETE" && parts.length === 4 && parts[3] === "delete-card") {
    await prisma.card.delete({ where: { id: cardId } });
    return ok({ message: "Card deleted" });
  }

  if (method === "PUT" && parts.length === 4 && parts[3] === "update-cover") {
    const body = await parseBody(request);
    await prisma.cardCover.upsert({
      where: { cardId },
      update: {
        color: body.color ?? null,
        isSizeOne: body.isSizeOne ?? null,
      },
      create: {
        cardId,
        color: body.color ?? null,
        isSizeOne: body.isSizeOne ?? null,
      },
    });
    return ok({ message: "Card cover updated" });
  }

  if (method === "POST" && parts.length === 4 && parts[3] === "add-comment") {
    const body = await parseBody(request);
    await prisma.cardActivity.create({
      data: {
        cardId,
        userName: authUser.name,
        text: body.text,
        isComment: true,
        color: authUser.color,
      },
    });
    const activities = await prisma.cardActivity.findMany({
      where: { cardId },
      orderBy: { createdAt: "desc" },
    });
    return ok(
      activities.map((item) => ({
        _id: item.id,
        userName: item.userName,
        text: item.text,
        date: item.createdAt,
        isComment: item.isComment,
        color: item.color,
      }))
    );
  }

  if (method === "PUT" && parts.length === 4) {
    const commentId = parts[3];
    const body = await parseBody(request);
    await prisma.cardActivity.update({ where: { id: commentId }, data: { text: body.text } });
    return ok({ message: "Comment updated" });
  }

  if (method === "DELETE" && parts.length === 4) {
    const commentId = parts[3];
    await prisma.cardActivity.delete({ where: { id: commentId } });
    return ok({ message: "Comment deleted" });
  }

  if (method === "POST" && parts.length === 4 && parts[3] === "add-member") {
    const body = await parseBody(request);
    const member = await prisma.user.findUnique({ where: { id: body.memberId } });
    if (!member) return fail("User not found", 404);
    await prisma.cardMember.upsert({
      where: { cardId_userId: { cardId, userId: member.id } },
      update: {},
      create: { cardId, userId: member.id, name: member.name, color: member.color },
    });
    return ok({ message: "Card member added" });
  }

  if (method === "DELETE" && parts.length === 5 && parts[4] === "delete-member") {
    const memberId = parts[3];
    await prisma.cardMember.deleteMany({ where: { cardId, userId: memberId } });
    return ok({ message: "Card member removed" });
  }

  if (method === "POST" && parts.length === 4 && parts[3] === "create-label") {
    const body = await parseBody(request);
    const label = await prisma.label.create({
      data: {
        cardId,
        text: body.text,
        color: body.color,
        backColor: body.backColor,
        selected: true,
      },
    });
    return ok({ labelId: label.id });
  }

  if (method === "PUT" && parts.length === 5 && parts[4] === "update-label") {
    const labelId = parts[3];
    const body = await parseBody(request);
    await prisma.label.update({
      where: { id: labelId },
      data: {
        text: body.text,
        color: body.color,
        backColor: body.backColor,
      },
    });
    return ok({ message: "Label updated" });
  }

  if (method === "PUT" && parts.length === 5 && parts[4] === "update-label-selection") {
    const labelId = parts[3];
    const body = await parseBody(request);
    await prisma.label.update({ where: { id: labelId }, data: { selected: Boolean(body.selected) } });
    return ok({ message: "Label selection updated" });
  }

  if (method === "DELETE" && parts.length === 5 && parts[4] === "delete-label") {
    const labelId = parts[3];
    await prisma.label.delete({ where: { id: labelId } });
    return ok({ message: "Label deleted" });
  }

  if (method === "POST" && parts.length === 4 && parts[3] === "add-attachment") {
    const body = await parseBody(request);
    const attachment = await prisma.attachment.create({
      data: {
        cardId,
        link: body.link,
        name: body.name,
      },
    });
    return ok({ attachmentId: attachment.id });
  }

  if (method === "PUT" && parts.length === 5 && parts[4] === "update-attachment") {
    const attachmentId = parts[3];
    const body = await parseBody(request);
    await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        link: body.link,
        name: body.name,
      },
    });
    return ok({ message: "Attachment updated" });
  }

  if (method === "DELETE" && parts.length === 5 && parts[4] === "delete-attachment") {
    const attachmentId = parts[3];
    await prisma.attachment.delete({ where: { id: attachmentId } });
    return ok({ message: "Attachment deleted" });
  }

  if (method === "PUT" && parts.length === 4 && parts[3] === "update-dates") {
    const body = await parseBody(request);
    await prisma.cardDate.upsert({
      where: { cardId },
      update: {
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        dueTime: body.dueTime ?? null,
      },
      create: {
        cardId,
        startDate: body.startDate ? new Date(body.startDate) : null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        dueTime: body.dueTime ?? null,
      },
    });
    return ok({ message: "Card dates updated" });
  }

  if (method === "PUT" && parts.length === 4 && parts[3] === "update-date-completed") {
    const body = await parseBody(request);
    await prisma.cardDate.upsert({
      where: { cardId },
      update: {
        completed: Boolean(body.completed),
      },
      create: {
        cardId,
        completed: Boolean(body.completed),
      },
    });
    return ok({ message: "Card completion updated" });
  }

  if (method === "POST" && parts.length === 4 && parts[3] === "create-checklist") {
    const body = await parseBody(request);
    const checklist = await prisma.checklist.create({
      data: {
        cardId,
        title: body.title,
      },
    });
    return ok({ checklistId: checklist.id });
  }

  if (method === "DELETE" && parts.length === 5 && parts[4] === "delete-checklist") {
    const checklistId = parts[3];
    await prisma.checklist.delete({ where: { id: checklistId } });
    return ok({ message: "Checklist deleted" });
  }

  if (method === "POST" && parts.length === 5 && parts[4] === "add-checklist-item") {
    const checklistId = parts[3];
    const body = await parseBody(request);
    const item = await prisma.checklistItem.create({
      data: {
        checklistId,
        text: body.text,
      },
    });
    return ok({ checklistItemId: item.id });
  }

  if (method === "PUT" && parts.length === 6 && parts[5] === "set-checklist-item-completed") {
    const checklistItemId = parts[4];
    const body = await parseBody(request);
    await prisma.checklistItem.update({
      where: { id: checklistItemId },
      data: {
        completed: Boolean(body.completed),
      },
    });
    return ok({ message: "Checklist item completion updated" });
  }

  if (method === "PUT" && parts.length === 6 && parts[5] === "set-checklist-item-text") {
    const checklistItemId = parts[4];
    const body = await parseBody(request);
    await prisma.checklistItem.update({
      where: { id: checklistItemId },
      data: {
        text: body.text,
      },
    });
    return ok({ message: "Checklist item text updated" });
  }

  if (method === "DELETE" && parts.length === 6 && parts[5] === "delete-checklist-item") {
    const checklistItemId = parts[4];
    await prisma.checklistItem.delete({ where: { id: checklistItemId } });
    return ok({ message: "Checklist item deleted" });
  }

  return fail("Not found", 404);
};

const handleRequest = async (request: NextRequest, method: string, ctx: { params: Promise<{ path: string[] }> }) => {
  const params = await ctx.params;
  const [scope, ...parts] = params.path || [];

  if (scope === "user") {
    return handleUser(request, method, parts);
  }
  if (scope === "board") {
    return handleBoard(request, method, parts);
  }
  if (scope === "list") {
    return handleList(request, method, parts);
  }
  if (scope === "card") {
    return handleCard(request, method, parts);
  }

  return fail("Not found", 404);
};

export async function GET(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, "GET", ctx);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, "POST", ctx);
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, "PUT", ctx);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, "DELETE", ctx);
}
