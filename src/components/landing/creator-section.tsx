import Image from "next/image";

import { Reveal } from "@/components/motion/reveal";
import { AppIcon, AppIconName } from "@/components/ui/app-icon";

import styles from "./creator-section.module.css";

export const creator = {
  name: "Abhishek Prajapati",
  role: "Creator & Developer of AbhiAI",
  bio: "I'm building AbhiAI with the goal of creating an intelligent platform that brings AI assistance, multimodal capabilities, intelligent automation, and social interaction into a unified experience.",
  image: "/creator/abhishek-prajapati.jpg",
  imageAlt: "Portrait of Abhishek Prajapati, creator of AbhiAI",
  highlights: ["Developer", "Computer Science", "AI & Software", "Building AbhiAI"],
  links: {
    github: "https://github.com/Ap-95671",
    linkedin: "",
    portfolio: "",
    email: "",
  },
} as const;

type CreatorLink = {
  external: boolean;
  href: string;
  icon: AppIconName;
  label: string;
};

const creatorLinks = ([
  { external: true, href: creator.links.github, icon: "github", label: "GitHub" },
  { external: true, href: creator.links.linkedin, icon: "linkedin", label: "LinkedIn" },
  { external: true, href: creator.links.portfolio, icon: "globe", label: "Portfolio" },
  { external: false, href: creator.links.email ? `mailto:${creator.links.email}` : "", icon: "message", label: "Email" },
] satisfies CreatorLink[]).filter(({ href }) => Boolean(href));

export function CreatorSection() {
  return (
    <section aria-labelledby="creator-heading" className={styles.section} id="creator">
      <span aria-hidden="true" className={styles.glow} />
      <Reveal className={styles.heading} threshold={0.16} variant="up">
        <p className={styles.eyebrow}>The person behind the product</p>
        <h2 id="creator-heading">Meet the Creator</h2>
        <p>Meet the person behind AbhiAI.</p>
      </Reveal>

      <div className={styles.card}>
        <Reveal className={styles.photoColumn} threshold={0.16} variant="left">
          <div className={styles.photoFrame}>
            <div className={styles.photoCrop}>
              <Image
                alt={creator.imageAlt}
                className={styles.photo}
                height={1448}
                sizes="(max-width: 760px) calc(100vw - 64px), (max-width: 1100px) 38vw, 460px"
                src={creator.image}
                width={1088}
              />
            </div>
            <span aria-hidden="true" className={styles.photoAccent}>A</span>
          </div>
        </Reveal>

        <Reveal className={styles.details} delay={90} threshold={0.16} variant="right">
          <p className={styles.role}>{creator.role}</p>
          <h3>{creator.name}</h3>
          <p className={styles.bio}>{creator.bio}</p>

          <ul aria-label="Creator focus areas" className={styles.highlights}>
            {creator.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>

          {creatorLinks.length > 0 && (
            <ul aria-label="Creator profiles" className={styles.socialLinks}>
              {creatorLinks.map((link, index) => (
                <Reveal as="li" delay={220 + (index * 80)} key={link.label} threshold={0.12} variant="up">
                  <a
                    aria-label={`Visit ${creator.name}'s ${link.label}${link.external ? " in a new tab" : ""}`}
                    href={link.href}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    target={link.external ? "_blank" : undefined}
                  >
                    <AppIcon name={link.icon} />
                    <span>{link.label}</span>
                    {link.external && <span aria-hidden="true" className={styles.externalArrow}>↗</span>}
                  </a>
                </Reveal>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </section>
  );
}
