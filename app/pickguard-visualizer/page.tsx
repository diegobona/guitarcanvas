import { PickguardVisualizer } from "@/components/pickguard/PickguardVisualizer";

export const metadata = {
  title: "AI Guitar Pickguard Visualizer | GuitarCanvas",
  description:
    "Upload your guitar photo, try custom pickguard designs, and export printable design files.",
};

export default function PickguardVisualizerPage() {
  return <PickguardVisualizer />;
}
