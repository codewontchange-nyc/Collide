import { useInstall } from "@/pwa/install";
import { ListRow, StatusWord, toast } from "@/system";

/** The install row on You: a word row with a chevron; once installed it is not pressable and says so with a dot and a word. */
export function InstallRow() {
  const { installed, canPrompt, ios, prompt } = useInstall();
  if (installed) {
    return (
      <ListRow
        title="Colony is on your home screen"
        facts="Thank you for keeping us close."
        trailing={
          <StatusWord state="success" pulse={false}>
            INSTALLED
          </StatusWord>
        }
      />
    );
  }
  return (
    <ListRow
      title="Install Colony"
      facts={ios ? "Share, then Add to Home Screen" : "Keep your colony one tap away"}
      chevron
      onPress={async () => {
        if (canPrompt) {
          const ok = await prompt();
          toast.show(ok ? "Welcome home." : "Maybe later.");
        } else if (ios) {
          toast.show("Tap Share, then Add to Home Screen.", { ms: 4200 });
        } else {
          toast.show("Open this in Safari or Chrome to install.", { ms: 3600 });
        }
      }}
    />
  );
}
