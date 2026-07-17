import PrivateGame from "./PrivateGame";

export default async function PrivateHidePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PrivateGame code={code} />;
}
