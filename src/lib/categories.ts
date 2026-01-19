import { 
  Heart, 
  Brain, 
  Stethoscope, 
  Eye, 
  Bone, 
  Baby, 
  Pill, 
  Microscope, 
  Activity, 
  Wind,
  Syringe,
  Thermometer,
  BookOpen,
  type LucideIcon
} from 'lucide-react';

export interface CategoryConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string; // Tailwind color class
}

export const CONTENT_CATEGORIES: CategoryConfig[] = [
  { id: 'general', label: 'General', icon: BookOpen, color: 'text-muted-foreground' },
  { id: 'cardiology', label: 'Cardiology', icon: Heart, color: 'text-red-500' },
  { id: 'neurology', label: 'Neurology', icon: Brain, color: 'text-purple-500' },
  { id: 'pulmonology', label: 'Pulmonology', icon: Wind, color: 'text-blue-400' },
  { id: 'orthopedics', label: 'Orthopedics', icon: Bone, color: 'text-amber-600' },
  { id: 'ophthalmology', label: 'Ophthalmology', icon: Eye, color: 'text-cyan-500' },
  { id: 'pediatrics', label: 'Pediatrics', icon: Baby, color: 'text-pink-400' },
  { id: 'pharmacology', label: 'Pharmacology', icon: Pill, color: 'text-green-500' },
  { id: 'pathology', label: 'Pathology', icon: Microscope, color: 'text-indigo-500' },
  { id: 'physiology', label: 'Physiology', icon: Activity, color: 'text-orange-500' },
  { id: 'surgery', label: 'Surgery', icon: Syringe, color: 'text-slate-500' },
  { id: 'internal-medicine', label: 'Internal Medicine', icon: Stethoscope, color: 'text-teal-500' },
  { id: 'diagnostics', label: 'Diagnostics', icon: Thermometer, color: 'text-yellow-500' },
];

export function getCategoryConfig(categoryId: string): CategoryConfig {
  return CONTENT_CATEGORIES.find(c => c.id === categoryId) || CONTENT_CATEGORIES[0];
}
