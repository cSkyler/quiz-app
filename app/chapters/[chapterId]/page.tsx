import ChapterPracticeClient from '@/components/ChapterPracticeClient'

export default function Page({ params }: { params: { chapterId: string } }) {
  return <ChapterPracticeClient chapterId={params.chapterId} />
}
