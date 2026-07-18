import { useParams } from "wouter";
import { ExpertProfileContent } from "@/components/expert-profile-content";

export default function ExpertProfile() {
  const params = useParams();
  return <ExpertProfileContent handle={params.handle || ""} />;
}
