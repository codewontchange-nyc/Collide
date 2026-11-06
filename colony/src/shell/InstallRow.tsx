import { useInstall } from "@/pwa/install";
import { Icon } from "@/ui/Icon";
import { toast } from "@/ui/Toast";

export function InstallRow() {
  const { installed, canPrompt, ios, prompt } = useInstall();
  if (installed)
    return (
      <div className="item">
        <Icon name="check" />
        <div className="grow">
          <div className="t">Colony is on your home screen</div>
          <div className="m">Thank you for keeping us close.</div>
        </div>
      </div>
    );
  return (
    <button
      type="button"
      className="item press"
      onClick={async () => {
        if (canPrompt) {
          const ok = await prompt();
          toast.show(ok ? "Welcome home." : "Maybe later.");
        } else if (ios) {
          toast.show("Tap Share, then Add to Home Screen.", { ms: 4200 });
        } else {
          toast.show("Open this in Safari or Chrome to install.", { ms: 3600 });
        }
      }}
    >
      <Icon name="install" />
      <div className="grow">
        <div className="t">Install Colony</div>
        <div className="m">{ios ? "Share, then Add to Home Screen" : "Keep your colony one tap away"}</div>
      </div>
      <Icon name="chev" size={16} />
    </button>
  );
}
