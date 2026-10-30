import { useEffect, useRef, useState } from "react";
import { hapticLight } from "../../lib/haptics";
import "./onboarding.css";

/*
  Onboarding Amiv — animations "niveau 1"
  Zéro dépendance : CSS + une seule variable (--p) mise à jour au scroll.

  Props :
    avatars   : 5 URLs de photos pour l'écran d'accueil
    onSignup  : appelé à la fin (bouton "C'est parti" / "Passer")
    onLogin   : appelé par "J'ai déjà un compte"
    slides    : [{ title, text, vignette: <JSX> }] — remplace les vignettes
                par celles de tes maquettes. Chaque élément animé reçoit
                className="ob-card" et style={{ "--i": n }} (ordre d'entrée).
*/

export default function Onboarding({ avatars = [], slides = DEFAULT_SLIDES, onSignup, onLogin }) {
  const [step, setStep] = useState("welcome"); // "welcome" | "slides"
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const rootRef = useRef(null);
  const scrollerRef = useRef(null);
  const slideRefs = useRef([]);

  // Une seule source de vérité : la position du swipe, de 0 à slides.length - 1
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = el.scrollLeft / el.clientWidth;
      rootRef.current?.style.setProperty("--p", p.toFixed(3));
      slideRefs.current.forEach((s, i) => s?.style.setProperty("--d", (p - i).toFixed(3)));
      const idx = Math.round(p);
      setActive((prev) => (prev === idx ? prev : idx)); // ne re-rend qu'au changement de slide
      setSeen((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [step]);

  const next = () => {
    hapticLight(); // Haptics.impact({ style: ImpactStyle.Light }), sans effet sur le web
    if (active >= slides.length - 1) return onSignup?.();
    const el = scrollerRef.current;
    el.scrollTo({ left: (active + 1) * el.clientWidth, behavior: "smooth" });
  };

  const isLast = active === slides.length - 1;

  if (step === "welcome") {
    return (
      <div className="ob ob-welcome">
        <div className="ob-orbit">
          {avatars.slice(0, 5).map((src, i) => (
            <div key={src} className={`ob-avatar ob-avatar--${i}`} style={{ "--i": i }}>
              <img src={src} alt="" />
            </div>
          ))}
          <h1 className="ob-word">amiv</h1>
        </div>
        <div className="ob-welcome-text">
          <h2 className="ob-title">L'essentiel, c'est d'être ensemble</h2>
          <p className="ob-text">Les anniversaires, les soirées et les moments de tes proches, au même endroit.</p>
        </div>
        <div className="ob-actions">
          <button className="ob-cta" onClick={() => setStep("slides")}>Commencer</button>
          <button className="ob-link" onClick={onLogin}>J'ai déjà un compte</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={`ob ob-carousel${isLast ? " is-dark" : ""}`}>
      <div className="ob-night" aria-hidden="true" />

      <header className="ob-top">
        <div className="ob-progress">
          {slides.map((_, i) => (
            <span key={i} style={{ "--i": i }}><i /></span>
          ))}
        </div>
        <button className="ob-skip" onClick={onSignup}>Passer</button>
      </header>

      <div ref={scrollerRef} className="ob-scroller">
        {slides.map((s, i) => (
          <section
            key={i}
            ref={(el) => (slideRefs.current[i] = el)}
            className={`ob-slide${seen.has(i) ? " is-seen" : ""}`}
          >
            <div className="ob-vignette">{s.vignette}</div>
            <div className="ob-copy">
              <h2 className="ob-title">{s.title}</h2>
              <p className="ob-text">{s.text}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="ob-actions">
        <button className="ob-cta" onClick={next}>{isLast ? "C'est parti" : "Continuer"}</button>
      </div>
    </div>
  );
}

// Dispos de la semaine : nombre d'amis libres par jour
const WEEK = [["L", 1], ["M", 0], ["M", 2], ["J", 1], ["V", 5], ["S", 3], ["D", 2]];

const DEFAULT_SLIDES = [
  {
    title: "Ne rate plus aucun moment",
    text: "Les anniversaires te sont rappelés à temps, et tu vois d'un coup d'œil qui est libre pour se voir.",
    vignette: (
      <div className="ob-panel ob-panel--pink">
        <div className="ob-card ob-row" style={{ "--i": 0 }}>
          <span className="ob-initial">L</span>
          <span className="ob-lines">
            <span className="ob-strong">Anniversaire de Léa</span>
            <span className="ob-sub">Dans 3 jours · 28 ans</span>
          </span>
          <span className="ob-pill">Rappel</span>
        </div>
        <div className="ob-card" style={{ "--i": 1 }}>
          <span className="ob-strong">Qui est libre cette semaine ?</span>
          <span className="ob-week">
            {WEEK.map(([day, free], i) => (
              <span key={i} className={i === 4 ? "is-on" : undefined}>
                {day}
                <b>{free}</b>
              </span>
            ))}
          </span>
        </div>
        <div className="ob-card ob-card--dark" style={{ "--i": 2 }}>
          Vendredi soir : 5 amis libres
        </div>
      </div>
    ),
  },
  {
    title: "Organise la fête en deux minutes",
    text: "Invitations, réponses en direct, sondages, chat des invités et album photo partagé.",
    vignette: (
      <div className="ob-panel ob-panel--peach">
        <div className="ob-card ob-row" style={{ "--i": 0 }}>
          <span className="ob-lines">
            <span className="ob-sub">Invitation</span>
            <span className="ob-strong">Crémaillère chez Inès</span>
            <span className="ob-sub">Sam. 14 nov · 20 h</span>
          </span>
          <span className="ob-pill ob-pill--solid">J'y serai</span>
        </div>
        <div className="ob-card ob-stats" style={{ "--i": 1 }}>
          <span><b>12</b>viennent</span>
          <span><b>3</b>peut-être</span>
          <span><b>2</b>absents</span>
        </div>
        <div className="ob-card" style={{ "--i": 2 }}>
          <span className="ob-strong">Sondage · On apporte quoi ?</span>
          <span className="ob-poll">
            <span style={{ "--w": "62%" }}>Desserts<b>8</b></span>
            <span style={{ "--w": "38%" }}>Boissons<b>5</b></span>
          </span>
        </div>
      </div>
    ),
  },
  {
    title: "Prépare la surprise en secret",
    text: "Un espace caché de la personne fêtée, une wishlist, un coordinateur pour les cadeaux, et des souvenirs révélés le jour J.",
    vignette: (
      <div className="ob-panel ob-panel--plum">
        <div className="ob-card ob-card--glass ob-row" style={{ "--i": 0 }}>
          <span className="ob-lines">
            <span className="ob-strong">Espace secret · Anniv de Léa</span>
            <span className="ob-sub">6 complices dans la discussion</span>
          </span>
          <span className="ob-pill ob-pill--glass">Invisible pour Léa</span>
        </div>
        <div className="ob-card ob-card--glass" style={{ "--i": 1 }}>
          <span className="ob-row">
            <span className="ob-strong">Cagnotte</span>
            <span className="ob-sub ob-end">234 € sur 300 €</span>
          </span>
          <span className="ob-bar" style={{ "--w": "78%" }}><i /></span>
        </div>
        <div className="ob-card ob-card--glass ob-row" style={{ "--i": 2 }}>
          <span className="ob-thumb">2019</span>
          <span className="ob-lines">
            <span className="ob-strong">Flashback</span>
            <span className="ob-sub">12 souvenirs révélés le jour J</span>
          </span>
        </div>
      </div>
    ),
  },
];
