import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: { surveyVideoSets: true },
  });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await Promise.all(
    survey.surveyVideoSets
      .filter((s: { compositeUrl: string | null }) => s.compositeUrl)
      .map((s: { compositeUrl: string | null }) => deleteFile(s.compositeUrl!))
  );
  await prisma.survey.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
