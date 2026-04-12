type UserLite = {
  id: string;
  name: string;
  surname: string;
  email: string;
  avatar: string | null;
  color: string;
};

export const toLegacyUser = (user: UserLite & { token?: string; boards?: unknown[] }) => ({
  _id: user.id,
  name: user.name,
  surname: user.surname,
  email: user.email,
  avatar: user.avatar,
  color: user.color,
  boards: user.boards ?? [],
  ...(user.token ? { token: user.token } : {}),
});

export const normalizeDate = (date?: {
  startDate: Date | null;
  dueDate: Date | null;
  dueTime: string | null;
  completed: boolean;
} | null) => ({
  startDate: date?.startDate ?? null,
  dueDate: date?.dueDate ?? null,
  dueTime: date?.dueTime ?? null,
  completed: date?.completed ?? false,
});

export const normalizeCover = (cover?: { color: string | null; isSizeOne: boolean | null } | null) => ({
  color: cover?.color ?? null,
  isSizeOne: cover?.isSizeOne ?? null,
});
