"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

import { AppIcon } from "@/components/ui/app-icon";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Reveal } from "@/components/motion/reveal";
import { ScrollMotion } from "@/components/motion/scroll-motion";
import { CreatorSection } from "@/components/landing/creator-section";

import styles from "./landing-page.module.css";

type LandingPageProps = {
  onLogin: () => void;
  onStart: (prompt?: string) => void;
};

const capabilityCopy = {
  Chat: ["Think through complex questions", "Reason, write, and build together"],
  Create: ["Shape ideas into finished work", "Generate visuals and original content"],
  Search: ["Explore the web and your network", "Find people, posts, and perspectives"],
  Analyze: ["Understand files and discussions", "Surface arguments, patterns, and context"],
} as const;

export function LandingPage({ onLogin, onStart }: LandingPageProps) {
  const [prompt, setPrompt] = useState("");
  const [capability, setCapability] = useState<keyof typeof capabilityCopy>("Chat");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", close); };
  }, [menuOpen]);

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart(prompt.trim() || undefined);
  }

  return (
    <main className={styles.page}>
      <ScrollMotion />
      {menuOpen && <button aria-label="Close navigation" className={styles.menuBackdrop} onClick={() => setMenuOpen(false)} type="button"/>}
      <header className={styles.navbar} data-scroll-navbar>
        <a aria-label="AbhiAI home" className={styles.brand} href="#top">
          <span><Image alt="" height={38} priority src="/abhiai-logo.png" width={38} /></span>
          AbhiAI
        </a>
        <button aria-expanded={menuOpen} aria-label="Toggle navigation" className={styles.menuButton} onClick={() => setMenuOpen((value) => !value)} type="button">
          <i /><i />
        </button>
        <nav className={menuOpen ? styles.navOpen : ""} aria-label="Public navigation">
          <a href="#product" onClick={() => setMenuOpen(false)}>Product</a><a href="#ai" onClick={() => setMenuOpen(false)}>AI</a><a href="#social" onClick={() => setMenuOpen(false)}>Social</a><a href="#explore" onClick={() => setMenuOpen(false)}>Explore</a><a href="#about" onClick={() => setMenuOpen(false)}>About</a>
          <div className={styles.mobileNavActions}>
            <ThemeToggle />
            <button onClick={() => { setMenuOpen(false); onLogin(); }} type="button">Log in</button>
            <button onClick={() => { setMenuOpen(false); onStart(); }} type="button">Get started</button>
          </div>
        </nav>
        <div className={styles.navActions}>
          <ThemeToggle compact />
          <button className={styles.ghostButton} onClick={onLogin} type="button">Log in</button>
          <button className={styles.lightButton} onClick={() => onStart()} type="button">Get started</button>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={`${styles.kicker} ${styles.heroRevealOne}`}><span /> Intelligence, in conversation</p>
          <h1 className={styles.heroRevealTwo}>Think deeper.<br /><em>Connect differently.</em></h1>
          <p className={`${styles.heroIntro} ${styles.heroRevealThree}`}>AbhiAI brings intelligent assistance, creative tools, and a living network into one focused place.</p>
          <form className={`${styles.prompt} ${styles.heroRevealFour}`} onSubmit={submitPrompt}>
            <Image alt="" className={styles.promptMark} src="/abhiai-logo.png" width={29} height={29} />
            <input aria-label="Ask AbhiAI" onChange={(event) => setPrompt(event.target.value)} placeholder="Ask AbhiAI anything…" value={prompt} />
            <button aria-label="Start with this prompt" type="submit"><AppIcon name="send" /></button>
          </form>
          <div className={`${styles.heroActions} ${styles.heroRevealFive}`}>
            <button className={styles.lightButton} onClick={() => onStart()} type="button">Start with AbhiAI <span>↗</span></button>
            <a href="#social">Explore the network <span>↓</span></a>
          </div>
        </div>

        <div aria-label="AbhiAI product preview" className={`${styles.heroVisual} ${styles.heroVisualReveal}`}>
          <div className={styles.orbitGlow} data-parallax="12" />
          <article className={`${styles.floatCard} ${styles.aiCard}`} data-parallax="18">
            <div className={styles.cardTop}><Image alt="AbhiAI" className={styles.miniLogo} src="/abhiai-logo.png" width={29} height={29} /><b>AbhiAI</b><small>Example conversation</small></div>
            <p>What should I take from this discussion?</p>
            <div className={styles.summaryLines}><p>Start with the main claim, check its supporting sources, then compare the replies.</p><span>Next step · Ask a follow-up</span></div>
          </article>
          <article className={`${styles.floatCard} ${styles.socialCard}`} data-parallax="-14">
            <div className={styles.person}><span>NP</span><div><b>Nia Patel</b><small>@niabuilds · 12m</small></div></div>
            <p>The most useful AI won’t live beside our communities. It will understand them.</p>
            <footer><span><AppIcon name="heart" /> Like</span><span><AppIcon name="reply" /> Reply</span><b>Example post</b></footer>
          </article>
          <article className={`${styles.floatCard} ${styles.trendCard}`} data-parallax="22">
            <small>EXPLORE A TOPIC</small><b>#HumanCenteredAI</b><span>People, posts and conversations</span>
          </article>
        </div>
      </section>

      <section className={styles.manifesto} id="product">
        <Reveal as="p" variant="fade">One product. Three essential modes.</Reveal>
        <Reveal delay={60} variant="scale"><span>01</span><h2>Think</h2><p>Work with an assistant that helps you reason, understand, and move ideas forward.</p></Reveal>
        <Reveal delay={140} variant="scale"><span>02</span><h2>Create</h2><p>Turn prompts, files, and inspiration into useful work and original media.</p></Reveal>
        <Reveal delay={220} variant="scale"><span>03</span><h2>Connect</h2><p>Join a network where ideas, creators, and intelligent context meet.</p></Reveal>
      </section>

      <section className={styles.integration} id="social">
        <Reveal className={styles.sectionCopy} variant="left">
          <p className={styles.kicker}><span /> AI inside the conversation</p>
          <h2>Context is one action away.</h2>
          <p>AbhiAI does more than show what people are saying. It helps you understand why it matters.</p>
          <ul><li>Explain a post in plain language</li><li>Summarize the discussion</li><li>Compare viewpoints and find related ideas</li></ul>
        </Reveal>
        <Reveal className={styles.demoWindow} data-depth-card delay={90} variant="scale">
          <div className={styles.demoPost}>
            <div className={styles.person}><span>YK</span><div><b>Yara Kim</b><small>@yara · Today</small></div></div>
            <p>Small models running on-device may reshape how we think about private, personal AI.</p>
            <div className={styles.postActions}><span><AppIcon name="heart" /> Like</span><span><AppIcon name="reply" /> Comment</span><span><AppIcon name="share" /> Share</span><span>Example discussion</span></div>
          </div>
          <div className={styles.aiAnswer} data-parallax="8">
            <header><Image alt="AbhiAI" className={styles.miniLogo} src="/abhiai-logo.png" width={29} height={29} /><b>Ask AbhiAI</b><small>Discussion insight</small></header>
            <p><strong>Why this matters</strong> — The discussion centers on latency, privacy, and where personal context should live.</p>
            <div>{["Explain", "Key arguments", "Related ideas"].map(label => <button key={label} onClick={() => onStart(`${label}: how do on-device models affect private, personal AI?`)} type="button">{label}</button>)}</div>
          </div>
        </Reveal>
      </section>

      <section className={styles.aiSection} id="ai">
        <Reveal className={styles.sectionHeading} variant="mask"><p className={styles.kicker}><span /> A complete AI workspace</p><h2>From first thought to finished work.</h2></Reveal>
        <Reveal aria-label="AI capabilities" className={styles.capabilityTabs} delay={70} role="group" variant="fade">
          {(Object.keys(capabilityCopy) as Array<keyof typeof capabilityCopy>).map((item) => <button aria-pressed={capability === item} className={capability === item ? styles.activeTab : ""} key={item} onClick={() => setCapability(item)} type="button">{item}</button>)}
        </Reveal>
        <Reveal className={styles.workspacePreview} data-depth-card delay={120} variant="scale">
          <aside><div className={styles.previewBrand}><Image alt="AbhiAI" className={styles.miniLogo} src="/abhiai-logo.png" width={29} height={29} /> AbhiAI</div><button onClick={() => onStart()} type="button"><AppIcon name="plus" /> New conversation</button><small>RECENT</small><p>Designing a better onboarding</p><p>Research synthesis</p><p>Launch narrative</p></aside>
          <div className={styles.previewConversation}>
            <header><b>{capability} with AbhiAI</b><span>Private workspace</span></header>
            <div className={styles.previewMessage}><Image alt="AbhiAI" className={styles.miniLogo} src="/abhiai-logo.png" width={29} height={29} /><div><b>{capabilityCopy[capability][0]}</b><p>{capabilityCopy[capability][1]}. Bring your files, questions, and context—the workspace adapts around the task.</p></div></div>
            <div className={styles.previewComposer}><span>Message AbhiAI…</span><div><AppIcon name="plus" /><AppIcon name="search" /><AppIcon name="send" /></div></div>
          </div>
        </Reveal>
      </section>

      <section className={styles.searchSection} id="explore">
        <Reveal className={styles.sectionCopy} variant="fade"><p className={styles.kicker}>Your workspace, your context</p><h2>Useful by design.</h2><p>Search your network, keep conversations together, and choose what AbhiAI remembers.</p></Reveal>
        <div className={styles.principleStrip}>
          <Reveal><AppIcon name="profile" /><h3>Privacy</h3><p>User controlled</p><small>Choose whether saved memories and page context are used.</small></Reveal>
          <Reveal><AppIcon name="message" /><h3>Continuity</h3><p>Conversations stay together</p><small>Return to your questions, files and previous answers.</small></Reveal>
          <Reveal><AppIcon name="search" /><h3>Discovery</h3><p>People, posts and topics</p><small>Explore the network and open a discussion with AbhiAI.</small></Reveal>
        </div>
      </section>

      <Reveal as="section" className={styles.finalCta} data-depth-card id="about" threshold={0.16} variant="scale">
        <Image alt="" height={80} src="/abhiai-logo.png" width={80} />
        <p className={styles.kicker}>THE ABHIAI NETWORK</p>
        <h2>One place to think,<br />create, and connect.</h2>
        <div><button className={styles.lightButton} onClick={() => onStart()} type="button">Start with AbhiAI</button><a href="#product">Explore the product</a></div>
      </Reveal>

      <CreatorSection />

      <footer className={styles.footer}>
        <Reveal><a className={styles.brand} href="#top"><span><Image alt="" height={38} src="/abhiai-logo.png" width={38} /></span>AbhiAI</a><p>Intelligence for the way we think, create, and connect.</p></Reveal>
        <nav>
          <Reveal delay={60} variant="fade"><b>Product</b><a href="#ai">AbhiAI</a><a href="#social">Social</a><a href="#explore">Explore</a></Reveal>
          <Reveal delay={120} variant="fade"><b>Company</b><a href="#about">About</a><span>Contact</span></Reveal>
          <Reveal delay={180} variant="fade"><b>Resources</b><span>Help</span><span>Documentation</span></Reveal>
          <Reveal delay={240} variant="fade"><b>Legal</b><span>Privacy</span><span>Terms</span></Reveal>
        </nav>
        <Reveal as="small" variant="fade">© {new Date().getFullYear()} AbhiAI. Built for thoughtful connection.</Reveal>
      </footer>
    </main>
  );
}
