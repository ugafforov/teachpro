import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, Users, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import gsap from 'gsap';

interface GroupStatisticsCardProps {
  totalStudents: number;
  attendancePercentage: number;
  totalLessons: number;
  topStudent: { name: string; score: number } | null;
  loading?: boolean;
}

const GroupStatisticsCard: React.FC<GroupStatisticsCardProps> = ({
  totalStudents,
  attendancePercentage,
  totalLessons,
  topStudent,
  loading = false
}) => {
  const [index, setIndex] = useState(0);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const sweep1Ref = useRef<HTMLDivElement>(null);
  const sweep2Ref = useRef<HTMLDivElement>(null);

  const animateCard = (
    cardRef: React.RefObject<HTMLDivElement>,
    sweepRef: React.RefObject<HTMLDivElement>,
    fromIdx: number,
    toIdx: number
  ) => {
    if (!cardRef.current) return;

    const currentItems = cardRef.current.querySelectorAll(`.item-${fromIdx}`);
    const nextItems = cardRef.current.querySelectorAll(`.item-${toIdx}`);

    const tl = gsap.timeline();

    // 1. Initial subtle card squeeze
    tl.to(cardRef.current, {
      scale: 0.98,
      duration: 0.3,
      ease: "power2.inOut"
    });

    // 2. Items exit with ultra-smooth blur and slide
    tl.to(currentItems, {
      y: -12,
      opacity: 0,
      filter: 'blur(15px)',
      scale: 0.95,
      duration: 0.7,
      stagger: 0.04,
      ease: "expo.inOut"
    }, "-=0.2");

    // 3. Light sweep effect
    if (sweepRef.current) {
      tl.fromTo(sweepRef.current,
        { x: '-100%', opacity: 0 },
        { x: '100%', opacity: 0.5, duration: 1, ease: "power3.inOut" },
        "-=0.5"
      );
    }

    // 4. Next items enter
    tl.fromTo(nextItems,
      { y: 12, opacity: 0, filter: 'blur(15px)', scale: 1.05 },
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        duration: 1.2,
        stagger: 0.08,
        ease: "expo.out"
      },
      "-=0.4"
    );

    // 5. Card returns to normal size
    tl.to(cardRef.current, {
      scale: 1,
      duration: 0.8,
      ease: "elastic.out(1, 0.8)"
    }, "-=1");
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = index === 0 ? 1 : 0;

      // Animate both cards simultaneously
      animateCard(card1Ref, sweep1Ref, index, nextIndex);
      animateCard(card2Ref, sweep2Ref, index, nextIndex);

      setIndex(nextIndex);
    }, 5000);

    return () => clearInterval(interval);
  }, [index]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {[1, 2].map((i) => (
          <Card key={i} className="h-14 animate-pulse bg-gray-100/50 border-none rounded-full" />
        ))}
      </div>
    );
  }

  const StatContent = ({
    icon: Icon,
    label,
    value,
    subValue,
    itemClass,
    isVisible
  }: {
    icon: any,
    label: string,
    value: string | number,
    subValue?: string,
    itemClass: string,
    isVisible: boolean
  }) => {
    const isTopStudent = label === "Top O'quvchi";
    const nameParts = String(value).split(' ');
    const displayValue = isTopStudent ? (nameParts[1] || nameParts[0]) : value;

    return (
      <div className={cn(
        "absolute inset-0 px-8 flex items-center justify-between",
        itemClass,
        !isVisible && "pointer-events-none opacity-0"
      )}>
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-white/10 backdrop-blur-2xl rounded-full border border-white/20 shadow-xl">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-white/60 leading-none mb-1.5">{label}</p>
            <p className="text-[10px] font-bold text-white/40 leading-none tracking-tight">{subValue}</p>
          </div>
        </div>

        <div className="relative">
          <h3 className="font-black tracking-tighter text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)] text-4xl whitespace-nowrap">
            {displayValue}
          </h3>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
      {/* Ribbon 1: Community & Excellence */}
      <Card
        ref={card1Ref}
        className="relative h-14 overflow-hidden border-none shadow-2xl rounded-full bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-700 group"
      >
        <div
          ref={sweep1Ref}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none opacity-0"
        />

        <StatContent
          icon={Users}
          label="O'quvchilar"
          value={totalStudents}
          subValue="Faol talabalar"
          itemClass="item-0"
          isVisible={index === 0}
        />
        <StatContent
          icon={Award}
          label="Top O'quvchi"
          value={topStudent ? topStudent.name : '---'}
          subValue={topStudent ? `${topStudent.score} ball` : 'Reyting'}
          itemClass="item-1"
          isVisible={index === 1}
        />

        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/5">
          <div
            className="h-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-[5000ms] ease-linear"
            style={{ width: `${(index + 1) * 50}%` }}
          />
        </div>
      </Card>

      {/* Ribbon 2: Progress & Activity */}
      <Card
        ref={card2Ref}
        className="relative h-14 overflow-hidden border-none shadow-2xl rounded-full bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-700 group"
      >
        <div
          ref={sweep2Ref}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none opacity-0"
        />

        <StatContent
          icon={Calendar}
          label="Darslar"
          value={totalLessons}
          subValue="Jami o'tilgan"
          itemClass="item-0"
          isVisible={index === 0}
        />
        <StatContent
          icon={TrendingUp}
          label="Davomat"
          value={`${attendancePercentage}%`}
          subValue="O'rtacha foiz"
          itemClass="item-1"
          isVisible={index === 1}
        />

        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/5">
          <div
            className="h-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-[5000ms] ease-linear"
            style={{ width: `${(index + 1) * 50}%` }}
          />
        </div>
      </Card>
    </div>
  );
};

export default GroupStatisticsCard;
