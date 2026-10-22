// The glowing "taste core" at the center of the Globe and the top of a profile.
export function CoreOrb({ size = 104, still = false }: { size?: number; still?: boolean }) {
  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <div
        className="absolute rounded-full"
        style={{
          inset: -size * 0.16,
          background: "radial-gradient(closest-side, #D9FFF8F0, #D9FFF866 30%, #D9FFF800)",
          animation: still ? undefined : "pulse-glow 3.5s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          background: "radial-gradient(circle at 34% 28%, #FFFFFF 0%, #A9DCD6 24%, #2F6F7E 64%, #173C47 100%)",
          boxShadow: "0 0 24px -4px #A9DCD6",
        }}
      >
        <div
          className="absolute -inset-[10%] rounded-full mix-blend-soft-light"
          style={{
            background: "conic-gradient(from 40deg, #FFEBC200, #FFEBC299, #24586600, #A9DCD688, #FFEBC200)",
          }}
        />
      </div>
      <div
        className="absolute rounded-full border border-accent"
        style={{ inset: -size * 0.1, transform: "rotate(-20deg) scaleY(0.32)" }}
      />
    </div>
  );
}
