"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

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

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStart(prompt.trim() || undefined);
  }

  return (
    <main className={styles.page}>
      <header className={styles.navbar}>
        <a aria-label="AbhiAI home" className={styles.brand} href="#top">
          <span><Image alt="" height={38} priority src="/abhiai-logo.png" width={38} /></span>
          AbhiAI
        </a>
        <button aria-expanded={menuOpen} aria-label="Toggle navigation" className={styles.menuButton} onClick={() => setMenuOpen((value) => !value)} type="button">
          <i /><i />
        </button>
        <nav className={menuOpen ? styles.navOpen : ""} aria-label="Public navigation">
          <a href="#product">Product</a><a href="#ai">AI</a><a href="#social">Social</a><a href="#explore">Explore</a><a href="#about">About</a>
          <div className={styles.mobileNavActions}>
            <button onClick={onLogin} type="button">Log in</button>
            <button onClick={() => onStart()} type="button">Get started</button>
          </div>
        </nav>
        <div className={styles.navActions}>
          <button className={styles.ghostButton} onClick={onLogin} type="button">Log in</button>
          <button className={styles.lightButton} onClick={() => onStart()} type="button">Get started</button>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}><span /> Intelligence, in conversation</p>
          <h1>Think deeper.<br /><em>Connect differently.</em></h1>
          <p className={styles.heroIntro}>AbhiAI brings intelligent assistance, creative tools, and a living network into one focused place.</p>
          <form className={styles.prompt} onSubmit={submitPrompt}>
            <span className={styles.promptMark}>A</span>
            <input aria-label="Ask AbhiAI" onChange={(event) => setPrompt(event.target.value)} placeholder="Ask AbhiAI anything…" value={prompt} />
            <button aria-label="Start with this prompt" type="submit">↑</button>
          </form>
          <div className={styles.heroActions}>
            <button className={styles.lightButton} onClick={() => onStart()} type="button">Start with AbhiAI <span>↗</span></button>
            <a href="#social">Explore the network <span>↓</span></a>
          </div>
        </div>

        <div aria-label="AbhiAI product preview" className={styles.heroVisual}>
          <div className={styles.orbitGlow} />
          <article className={`${styles.floatCard} ${styles.aiCard}`}>
            <div className={styles.cardTop}><span className={styles.miniLogo}>A</span><b>AbhiAI</b><small>Analyzing</small></div>
            <p>Here’s the signal behind today’s conversation.</p>
            <div className={styles.summaryLines}><i /><i /><i /></div>
          </article>
          <article className={`${styles.floatCard} ${styles.socialCard}`}>
            <div className={styles.person}><span>NP</span><div><b>Nia Patel</b><small>@niabuilds · 12m</small></div></div>
            <p>The most useful AI won’t live beside our communities. It will understand them.</p>
            <footer><span>♡ 482</span><span>◌ 76</span><b>✦ Ask AbhiAI</b></footer>
          </article>
          <article className={`${styles.floatCard} ${styles.trendCard}`}>
            <small>LIVE PULSE</small><b>#HumanCenteredAI</b><span>18.4K perspectives</span>
          </article>
        </div>
      </section>

      <section className={styles.manifesto} id="product">
        <p>One product. Three essential modes.</p>
        <div><span>01</span><h2>Think</h2><p>Work with an assistant that helps you reason, understand, and move ideas forward.</p></div>
        <div><span>02</span><h2>Create</h2><p>Turn prompts, files, and inspiration into useful work and original media.</p></div>
        <div><span>03</span><h2>Connect</h2><p>Join a network where ideas, creators, and intelligent context meet.</p></div>
      </section>

      <section className={styles.integration} id="social">
        <div className={styles.sectionCopy}>
          <p className={styles.kicker}><span /> AI inside the conversation</p>
          <h2>Context is one action away.</h2>
          <p>AbhiAI does more than show what people are saying. It helps you understand why it matters.</p>
          <ul><li>Explain a post in plain language</li><li>Summarize the discussion</li><li>Compare viewpoints and find related ideas</li></ul>
        </div>
        <div className={styles.demoWindow}>
          <div className={styles.demoPost}>
            <div className={styles.person}><span>YK</span><div><b>Yara Kim</b><small>@yara · Today</small></div></div>
            <p>Small models running on-device may reshape how we think about private, personal AI.</p>
            <div className={styles.postActions}><span>♡ 1.2K</span><span>◌ 214</span><span>↗ Share</span></div>
          </div>
          <div className={styles.aiAnswer}>
            <header><span className={styles.miniLogo}>A</span><b>Ask AbhiAI</b><small>Discussion insight</small></header>
            <p><strong>Why this matters</strong> — The discussion centers on latency, privacy, and where personal context should live.</p>
            <div><button type="button">Explain</button><button type="button">Key arguments</button><button type="button">Related posts</button></div>
          </div>
        </div>
      </section>

      <section className={styles.aiSection} id="ai">
        <div className={styles.sectionHeading}><p className={styles.kicker}><span /> A complete AI workspace</p><h2>From first thought to finished work.</h2></div>
        <div className={styles.capabilityTabs} role="tablist" aria-label="AI capabilities">
          {(Object.keys(capabilityCopy) as Array<keyof typeof capabilityCopy>).map((item) => <button aria-selected={capability === item} className={capability === item ? styles.activeTab : ""} key={item} onClick={() => setCapability(item)} role="tab" type="button">{item}</button>)}
        </div>
        <div className={styles.workspacePreview}>
          <aside><div className={styles.previewBrand}><span className={styles.miniLogo}>A</span> AbhiAI</div><button type="button">＋ New thread</button><small>RECENT</small><p>Designing a better onboarding</p><p>Research synthesis</p><p>Launch narrative</p></aside>
          <div className={styles.previewConversation}>
            <header><b>{capability} with AbhiAI</b><span>Private workspace</span></header>
            <div className={styles.previewMessage}><span className={styles.miniLogo}>A</span><div><b>{capabilityCopy[capability][0]}</b><p>{capabilityCopy[capability][1]}. Bring your files, questions, and context—the workspace adapts around the task.</p></div></div>
            <div className={styles.previewComposer}><span>Message AbhiAI…</span><div><i>＋</i><i>⌕</i><b>↑</b></div></div>
          </div>
        </div>
      </section>

      <section className={styles.searchSection} id="explore">
        <div className={styles.searchVisual}>
          <div className={styles.searchBar}>⌕ <span>Why is everyone discussing private AI today?</span><b>Search</b></div>
          <div className={styles.searchAnswer}><small>ABHIAI SYNTHESIS</small><h3>On-device models are moving from theory to daily use.</h3><p>Across 2,418 posts, the strongest themes are privacy, speed, and personal context.</p><div><span>Privacy <i style={{width:"88%"}} /></span><span>Latency <i style={{width:"71%"}} /></span><span>Ownership <i style={{width:"58%"}} /></span></div></div>
        </div>
        <div className={styles.sectionCopy}><p className={styles.kicker}><span /> Intelligent discovery</p><h2>Search what people mean, not only what they type.</h2><p>Discover people, posts, topics, conversations, and a clear AI synthesis in one search.</p></div>
      </section>

      <section className={styles.finalCta} id="about">
        <Image alt="" height={80} src="/abhiai-logo.png" width={80} />
        <p className={styles.kicker}>THE ABHIAI NETWORK</p>
        <h2>One place to think,<br />create, and connect.</h2>
        <div><button className={styles.lightButton} onClick={() => onStart()} type="button">Start with AbhiAI</button><a href="#product">Explore the product</a></div>
      </section>

      <footer className={styles.footer}>
        <div><a className={styles.brand} href="#top"><span><Image alt="" height={38} src="/abhiai-logo.png" width={38} /></span>AbhiAI</a><p>Intelligence for the way we think, create, and connect.</p></div>
        <nav><div><b>Product</b><a href="#ai">AbhiAI</a><a href="#social">Social</a><a href="#explore">Explore</a></div><div><b>Company</b><a href="#about">About</a><span>Contact</span></div><div><b>Resources</b><span>Help</span><span>Documentation</span></div><div><b>Legal</b><span>Privacy</span><span>Terms</span></div></nav>
        <small>© {new Date().getFullYear()} AbhiAI. Built for thoughtful connection.</small>
      </footer>
    </main>
  );
}
