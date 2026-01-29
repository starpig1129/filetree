import React, { useEffect, useRef } from 'react';

export const Starfield: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    
    // Star colors inspired by StellarNexus theme
    const starColors = ['#fff', '#22d3ee', '#a855f7', '#818cf8', '#ffffff'];
    
    const stars: { x: number; y: number; size: number; speed: number; opacity: number; color: string }[] = [];
    const starCount = 150;

    const initStars = () => {
      stars.length = 0;
      for (let i = 0; i < starCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5,
          speed: Math.random() * 0.12 + 0.03,
          opacity: Math.random() * 0.7 + 0.2,
          color: starColors[Math.floor(Math.random() * starColors.length)]
        });
      }
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const draw = () => {
      // Significantly increase alpha to shorten trails and prevent ghosting
      ctx.fillStyle = 'rgba(2, 2, 5, 0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Distant nebulas (soft, large blurred circles)
      ctx.globalCompositeOperation = 'screen';
      for(let i = 0; i < 3; i++) {
        const gradient = ctx.createRadialGradient(
          canvas.width * (0.2 + i * 0.3), canvas.height * (0.3 + (i%2) * 0.4), 0,
          canvas.width * (0.2 + i * 0.3), canvas.height * (0.3 + (i%2) * 0.4), canvas.width * 0.4
        );
        gradient.addColorStop(0, i === 0 ? 'rgba(123, 97, 255, 0.03)' : (i === 1 ? 'rgba(0, 255, 255, 0.02)' : 'rgba(255, 0, 255, 0.02)'));
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.globalCompositeOperation = 'source-over';

      stars.forEach(star => {
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.opacity;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Cosmic vertical drift with very slight horizontal drift
        star.y -= star.speed;
        star.x += star.speed * 0.05; 
        
        if (star.y < -10) {
          star.y = canvas.height + 10;
          star.x = Math.random() * canvas.width;
        }
        if (star.x > canvas.width + 10) {
          star.x = -10;
        }
        if (star.x < -10) {
          star.x = canvas.width + 10;
        }

        // Soft twinkle
        star.opacity += (Math.random() - 0.5) * 0.01;
        if (star.opacity < 0.2) star.opacity = 0.2;
        if (star.opacity > 0.8) star.opacity = 0.8;
      });
      
      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 -z-20 pointer-events-none opacity-90"
    />
  );
};
