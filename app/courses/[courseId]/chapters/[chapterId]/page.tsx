import ChapterPracticeClient from '@/components/ChapterPracticeClient'

export default function Page({ params }: { params: { courseId: string; chapterId: string } }) {
  return <ChapterPracticeClient chapterId={params.chapterId} courseId={params.courseId} />
}
