import "./amiv-logo.css";

// Logo texte « amiv » (Fredoka 700 + dégradé de la marque), partagé entre
// l'onboarding et l'écran de connexion.
export default function AmivLogo({ size = 64, as: Tag = "div", className = "", style }) {
  return (
    <Tag className={`amiv-logo ${className}`.trim()} style={{ fontSize: size, ...style }}>
      amiv
    </Tag>
  );
}
