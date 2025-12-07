import { useEffect, useRef } from "react";
import { cn } from "../../../lib/utils";

// Ideally we would use tsparticles if installed, but since we are in "safe mode"
// and I cannot confirm the user wants to install new packages, I will provide 
// a pure Canvas implementation of Sparkles to ensure it works out of the box
// without breaking the build with missing dependencies.

export const SparklesCore = (props: {
    id?: string;
    className?: string;
    background?: string;
    minSize?: number;
    maxSize?: number;
    speed?: number;
    particleColor?: string;
    particleDensity?: number;
}) => {
    const {
        id,
        className,
        background = "transparent",
        minSize = 0.6,
        maxSize = 1.4,
        speed = 1,
        particleColor = "#ffffff",
        particleDensity = 100,
    } = props;

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = (canvas.width = canvas.offsetWidth);
        let height = (canvas.height = canvas.offsetHeight);

        const particles: Particle[] = [];
        const particleCount = particleDensity;

        class Particle {
            x: number;
            y: number;
            size: number;
            speedX: number;
            speedY: number;

            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * (maxSize - minSize) + minSize;
                this.speedX = (Math.random() - 0.5) * speed;
                this.speedY = (Math.random() - 0.5) * speed;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x > width) this.x = 0;
                if (this.x < 0) this.x = width;
                if (this.y > height) this.y = 0;
                if (this.y < 0) this.y = height;
            }

            draw() {
                if (!ctx) return;
                ctx.fillStyle = particleColor;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const init = () => {
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);
            particles.forEach((particle) => {
                particle.update();
                particle.draw();
            });
            requestAnimationFrame(animate);
        };

        init();
        animate();

        const handleResize = () => {
            width = canvas.width = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
        };

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, [maxSize, minSize, particleColor, particleDensity, speed]);

    return (
        <canvas
            ref={canvasRef}
            className={cn("w-full h-full pointer-events-none", className)}
            style={{
                background: background,
            }}
            id={id || "sparkles-canvas"}
        />
    );
};
