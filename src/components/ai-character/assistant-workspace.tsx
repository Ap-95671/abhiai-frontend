"use client";
import { createContext, useContext, useEffect, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AbhiAIContextProvider } from "./abhiai-context";
import { AiCharacterLauncher } from "./ai-character-launcher";

type Session = { token: string; userId: string; obstructed: boolean } | null;
const SessionBridge = createContext<Dispatch<SetStateAction<Session>> | null>(null);
/** The host survives route changes; credentials still come from the existing authenticated app. */
export function AssistantWorkspace({ children }: { children: ReactNode }) {
  const [session,setSession] = useState<Session>(null);
  const pathname = usePathname();
  const router = useRouter();
  return <SessionBridge.Provider value={setSession}>
    <AbhiAIContextProvider key={session?.userId ?? "guest"} userId={session?.userId ?? "guest"}
      base={{ pageType:"other",route:pathname }} onOpenComposer={()=>router.push("/social")}>
      {children}
      {session && <AiCharacterLauncher token={session.token} userId={session.userId} obstructed={session.obstructed}/>}
    </AbhiAIContextProvider>
  </SessionBridge.Provider>;
}
export function useAssistantSession(resolved: boolean, token: string | null, userId: string | undefined, obstructed: boolean) {
  const update = useContext(SessionBridge);
  useEffect(() => {
    if (!resolved || !update) return;
    if (!token) update(null);
    else if (userId) update(current => current?.token === token && current.userId === userId && current.obstructed === obstructed
      ? current : { token, userId, obstructed });
  }, [resolved,token,userId,obstructed,update]);
}
