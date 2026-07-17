import PrivatePlay from "@/components/PrivatePlay";

export default async function PrivateTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PrivatePlay initialToken={token} />;
}
