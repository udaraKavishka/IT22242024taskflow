import { NextResponse } from "next/server";

export const ok = (data: unknown, status = 200) => {
  return NextResponse.json(data, { status });
};

export const fail = (message: string, status = 400, extra?: Record<string, unknown>) => {
  return NextResponse.json(
    {
      errMessage: message,
      ...extra,
    },
    { status }
  );
};
