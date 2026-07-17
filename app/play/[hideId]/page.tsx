import HideGame from "@/components/HideGame";

export default async function HidePage({
  params,
}: {
  params: Promise<{ hideId: string }>;
}) {
  const { hideId } = await params;
  return <HideGame hideId={hideId} backHref="/play" backLabel="Feed" />;
}
