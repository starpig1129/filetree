import React, { useEffect, useRef } from 'react';

/**
 * AuraField Component
 * 
 * Implements the "Ultimate Liquid Spatial Glass" design.
 * Features:
 * - Ambient Aurora (Layered gradients)
 * - Fluid Glass Blobs (Simplex-noise-like smooth movement)
 * - Interactive Parallax (Mouse responsive)
 * 
 * Optimized for 60FPS using HTML5 Canvas.
 */

// Simple pseudo-random for noise-like movement
const simplex = (x: number, y: number, t: number) => {
  return Math.sin(x * 0.005 + t) * Math.cos(y * 0.005 + t) * 0.5 + 0.5;
};

class Blob {
  x: number;
  y: number;
  size: number;
  color: string;
  vx: number;
  vy: number;
  seed: number;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.seed = Math.random() * 1000;
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.size = Math.random() * 600 + 400;
    const colors = [
      'rgba(240, 220, 255, 0.35)', // Muted Pastel Purple
      'rgba(210, 235, 255, 0.35)', // Muted Pastel Blue
      'rgba(255, 220, 240, 0.35)', // Muted Pastel Pink
      'rgba(225, 255, 245, 0.30)', // Muted Pastel Mint
    ];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.vx = (Math.random() - 0.5) * 0.25; // Slower speed for more stability
    this.vy = (Math.random() - 0.5) * 0.25;
  }

  update(t: number, mouse: { x: number, y: number }, width: number, height: number) {
    this.width = width;
    this.height = height;

    // Organic movement based on time and position
    const noiseX = simplex(this.x, this.y, t * 0.5 + this.seed);
    const noiseY = simplex(this.y, this.x, t * 0.5 + this.seed);
    
    this.x += this.vx + (noiseX - 0.5) * 3.0; // More turbulence
    this.y += this.vy + (noiseY - 0.5) * 3.0;

    // Mouse attraction (Subtle "Gravity Field")
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 900) {
          const force = (1 - dist / 900) * 0.08; // Gentler attraction
          this.x += dx * force;
          this.y += dy * force;
        }

    // Boundary check with wrapping
    if (this.x < -this.size) this.x = width + this.size;
    if (this.x > width + this.size) this.x = -this.size;
    if (this.y < -this.size) this.y = height + this.size;
    if (this.y > height + this.size) this.y = -this.size;
  }

  draw(context: CanvasRenderingContext2D) {
    const gradient = context.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.size
    );
    gradient.addColorStop(0, this.color);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fill();
  }
}

export const AuraField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let blobs: Blob[] = [];

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      
      blobs = [];
      for (let i = 0; i < 9; i++) {
        blobs.push(new Blob(width, height));
      }
    };

    const animate = (time: number) => {
      const t = time * 0.001;
      
      // Layer 1: Ambient Aurora (Base Gradient)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Gradient overlay for depth
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#f8fafc');
      bgGrad.addColorStop(1, '#f1f5f9');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // --- Layer 1: Ambient Glow (Extreme Blur, Low Saturation) ---
      ctx.filter = 'blur(140px) saturate(115%)';
      blobs.slice(0, 5).forEach(blob => {
        blob.update(t, mouseRef.current, width, height);
        blob.draw(ctx);
      });

      // --- Layer 2: Liquid Structure (Silk-like, Minimal Saturation) ---
      ctx.filter = 'blur(100px) saturate(105%)';
      blobs.slice(5, 9).forEach(blob => {
        blob.update(t * 1.2, mouseRef.current, width, height);
        blob.draw(ctx);
      });

      // Layer 3: Interactive Mouse Light (Subtle Highlight)
      const mouseGrad = ctx.createRadialGradient(
        mouseRef.current.x, mouseRef.current.y, 0,
        mouseRef.current.x, mouseRef.current.y, 500
      );
      mouseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
      mouseGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = mouseGrad;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      ctx.filter = 'none';

      requestRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleResize = () => {
      init();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    init();
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
      style={{ isolation: 'isolate' }}
    />
  );
};

export default AuraField;
