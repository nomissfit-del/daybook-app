import ProjectView from '@/components/ProjectView';

export default function WorkProjectPage({ params }: { params: { projectId: string } }) {
  return <ProjectView workspace="work" projectId={params.projectId} />;
}
