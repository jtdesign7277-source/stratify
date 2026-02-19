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

  .space-bg-meteor {
    position: absolute;
    width: var(--meteor-length, 220px);
    height: 2px;
    border-radius: 9999px;
    background: linear-gradient(
      90deg,
      rgba(151, 197, 255, 0) 0%,
      rgba(169, 205, 255, 0.18) 52%,
      rgba(232, 244, 255, 0.72) 86%,
      rgba(255, 255, 255, 0.98) 100%
    );
    transform-origin: right center;
    filter: drop-shadow(0 0 6px rgba(186, 222, 255, 0.55));
    opacity: 0;
    animation: spaceMeteor var(--meteor-duration, 18s) cubic-bezier(0.17, 0.67, 0.32, 0.99) infinite;
  }

  .space-bg-meteor::before {
    content: '';
    position: absolute;
    right: -2px;
    top: 50%;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    transform: translateY(-50%);
    background: radial-gradient(
      circle,
      rgba(255, 255, 255, 1) 0%,
      rgba(214, 234, 255, 0.98) 40%,
      rgba(145, 190, 255, 0.28) 72%,
      rgba(145, 190, 255, 0) 100%
    );
    box-shadow: 0 0 14px rgba(202, 229, 255, 0.95), 0 0 28px rgba(145, 190, 255, 0.45);
  }

  .space-bg-meteor::after {
    content: '';
    position: absolute;
    right: 12%;
    top: 50%;
    width: 58%;
    height: 8px;
    transform: translateY(-50%);
    background: linear-gradient(270deg, rgba(165, 198, 255, 0.24), rgba(165, 198, 255, 0));
    filter: blur(3px);
  }

  @keyframes spaceMeteor {
    0%, 88% {
      opacity: 0;
      transform: translate3d(0, 0, 0) rotate(var(--meteor-angle, 30deg)) scaleX(0.35);
    }
    89% {
      opacity: 0.9;
    }
    90% {
      opacity: 1;
    }
    98% {
      opacity: 0.65;
    }
    100% {
      opacity: 0;
      transform: translate3d(var(--meteor-x, 520px), var(--meteor-y, 270px), 0)
        rotate(var(--meteor-angle, 30deg)) scaleX(1);
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

const createMeteors = (count = 4, minDuration = 13, durationRange = 8, delayRange = 20) =>
  Array.from({ length: count }, (_, index) => {
    const travelX = 360 + Math.random() * 300;
    const travelY = 190 + Math.random() * 220;
    return {
      id: `space-meteor-${index}`,
      left: 3 + Math.random() * 44,
      top: 4 + Math.random() * 52,
      length: 140 + Math.random() * 95,
      duration: minDuration + Math.random() * durationRange,
      delay: -Math.random() * delayRange,
      travelX,
      travelY,
      angle: (Math.atan2(travelY, travelX) * 180) / Math.PI,
    };
  });

export default function SpaceBackground({ variant = 'app' }) {
  const isMarketing = variant === 'marketing';
  const stars = useMemo(() => createStars(isMarketing ? 86 : 70), [isMarketing]);
  const meteors = useMemo(
    () =>
      isMarketing
        ? createMeteors(4, 13, 8, 24)
        : createMeteors(2, 42, 36, 120),
    [isMarketing]
  );

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

        {meteors.map((meteor) => (
          <span
            key={meteor.id}
            className="space-bg-meteor"
            style={{
              left: `${meteor.left}%`,
              top: `${meteor.top}%`,
              '--meteor-length': `${meteor.length}px`,
              '--meteor-duration': `${meteor.duration}s`,
              animationDelay: `${meteor.delay}s`,
              '--meteor-x': `${meteor.travelX}px`,
              '--meteor-y': `${meteor.travelY}px`,
              '--meteor-angle': `${meteor.angle}deg`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 space-bg-scanlines" />
    </div>
  );
}
