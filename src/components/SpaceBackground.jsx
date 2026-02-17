import { useMemo } from 'react';

const spaceBackgroundStyles = `
  .space-bg-star {
    position: absolute;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.9);
    animation: spaceStarDrift linear infinite;
  }

  @keyframes spaceStarDrift {
    0% {
      opacity: 0.2;
      transform: translate3d(0, 0, 0);
    }
    50% {
      opacity: 0.75;
    }
    100% {
      opacity: 0.15;
      transform: translate3d(var(--drift-x, 0px), -80px, 0);
    }
  }

  .space-bg-shooting {
    position: absolute;
    width: 180px;
    height: 1px;
    background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0));
    filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.38));
    opacity: 0;
    transform: rotate(-28deg);
  }

  .space-bg-shooting-a {
    top: 16%;
    left: 8%;
    animation: spaceShootingA 18s linear infinite;
  }

  .space-bg-shooting-b {
    top: 48%;
    left: 30%;
    animation: spaceShootingB 20s linear infinite 8s;
  }

  @keyframes spaceShootingA {
    0%, 82% {
      opacity: 0;
      transform: translate3d(0, 0, 0) rotate(-28deg);
    }
    84% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate3d(460px, 250px, 0) rotate(-28deg);
    }
  }

  @keyframes spaceShootingB {
    0%, 85% {
      opacity: 0;
      transform: translate3d(0, 0, 0) rotate(-28deg);
    }
    87% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate3d(420px, 235px, 0) rotate(-28deg);
    }
  }

  .space-bg-scanlines {
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 2px,
      rgba(255, 255, 255, 0.02) 2px,
      rgba(255, 255, 255, 0.02) 3px
    );
  }
`;

const createStars = (count = 80) =>
  Array.from({ length: count }, (_, index) => ({
    id: `space-star-${index}`,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() > 0.7 ? 2 : 1,
    opacity: 0.25 + Math.random() * 0.75,
    duration: 60 + Math.random() * 60,
    delay: -Math.random() * 120,
    driftX: (Math.random() - 0.5) * 40,
  }));

export default function SpaceBackground() {
  const stars = useMemo(() => createStars(80), []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <style>{spaceBackgroundStyles}</style>

      <div className="absolute inset-0 bg-[#030608]" />

      <div className="absolute inset-0">
        {stars.map((star) => (
          <span
            key={star.id}
            className="space-bg-star"
            style={{
              width: `${star.size}px`,
              height: `${star.size}px`,
              left: `${star.left}%`,
              top: `${star.top}%`,
              opacity: star.opacity,
              animationDuration: `${star.duration}s`,
              animationDelay: `${star.delay}s`,
              '--drift-x': `${star.driftX}px`,
            }}
          />
        ))}

        <span className="space-bg-shooting space-bg-shooting-a" />
        <span className="space-bg-shooting space-bg-shooting-b" />
      </div>

      <div className="absolute inset-0 space-bg-scanlines" />
    </div>
  );
}
