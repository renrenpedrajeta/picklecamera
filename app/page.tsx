import PlayerPreview from "@/components/player-preview";
import { getAccount } from "@/lib/auth";
import LiveCourts from "@/components/live-courts";
import AccountControls from "@/components/account-controls";

export default async function Home() {
  const { account, problem } = await getAccount();
  return (
    <PlayerPreview
      livePanel={<LiveCourts account={account} problem={problem} />}
      accountControls={
        account ? (
          <AccountControls account={account} />
        ) : (
          <a className="sign-in" href="/login">
            Sign in →
          </a>
        )
      }
    />
  );
}
