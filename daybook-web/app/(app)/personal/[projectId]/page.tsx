import ProjectView from '@/components/ProjectView';

export default function PersonalProjectPage({ params }: { params: { projectId: string } }) {
  return <ProjectView workspace="personal" projectId={params.projectId} />;
}
