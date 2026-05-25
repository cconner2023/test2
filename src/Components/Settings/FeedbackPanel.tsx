import { useState } from 'react'
import { Star, Check, CheckCircle, RefreshCw } from 'lucide-react'
import { submitFeedback } from '../../lib/feedbackService'
import { ErrorDisplay } from '../ErrorDisplay'
import { TextInput } from '../FormInputs'
import { SectionCard, SectionHeader } from '../Section'
import { EmptyState } from '../EmptyState'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFeatureVotesStore } from '../../stores/useFeatureVotesStore'

export const FeedbackPanel = () => {
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')
  const [mostUseful, setMostUseful] = useState('')
  const [desiredFeature, setDesiredFeature] = useState('')
  const [needsImprovement, setNeedsImprovement] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = useAuthStore((s) => s.user?.id)
  const markFeedbackEngagement = useFeatureVotesStore((s) => s.markFeedbackEngagement)

  const hasContent =
    rating > 0 ||
    [mostUseful, desiredFeature, needsImprovement, comments].some((v) => v.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasContent) return

    setSubmitting(true)
    setError(null)

    const result = await submitFeedback({
      rating,
      comments: comments || null,
      most_useful_feature: mostUseful || null,
      desired_feature: desiredFeature || null,
      needs_improvement: needsImprovement || null,
    })

    setSubmitting(false)

    if (result.success) {
      if (userId) markFeedbackEngagement(userId)
      setSubmitted(true)
    } else {
      setError(result.error || 'Failed to submit feedback')
    }
  }

  if (submitted) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-5 pb-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
          <EmptyState
            variant="gate"
            icon={<CheckCircle size={32} className="text-themegreen" />}
            title="Thank you!"
            subtitle="Your feedback has been submitted. We appreciate your input!"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 pb-4 space-y-4 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">

        <p className="text-[10pt] text-primary leading-relaxed px-1">
          Help us improve by sharing your experience and suggestions.
        </p>

        {error && <ErrorDisplay message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Rating card */}
          <SectionCard className="px-4 py-3">
            <SectionHeader>How would you rate your experience?</SectionHeader>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-0.5 active:scale-95 transition-transform"
                  aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                >
                  <Star
                    size={28}
                    className={star <= rating ? 'text-themeblue2 fill-themeblue2' : 'text-themeblue2/20'}
                  />
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Details card */}
          <SectionCard>
            <TextInput
              value={mostUseful}
              onChange={setMostUseful}
              placeholder="Most useful feature?"
            />

            <TextInput
              value={desiredFeature}
              onChange={setDesiredFeature}
              placeholder="Feature you'd like to see added?"
            />

            <TextInput
              value={needsImprovement}
              onChange={setNeedsImprovement}
              placeholder="What needs improvement?"
            />

            <label className="block border-b border-primary/6">
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Additional comments"
                rows={3}
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
              />
            </label>

            {/* Submit — full-row reveal once any content is present */}
            <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${
              hasContent ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'
            }`}>
              <button
                type="submit"
                disabled={submitting}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
              </button>
            </div>
          </SectionCard>

        </form>

      </div>
    </div>
  )
}
