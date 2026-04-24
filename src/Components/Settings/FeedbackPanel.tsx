import { useState } from 'react'
import { Star, Check, CheckCircle, RefreshCw } from 'lucide-react'
import { submitFeedback } from '../../lib/feedbackService'
import { ErrorDisplay } from '../ErrorDisplay'
import { TextInput } from '../FormInputs'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFeatureVotesStore } from '../../stores/useFeatureVotesStore'

export const FeedbackPanel = () => {
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')
  const [mostUseful, setMostUseful] = useState('')
  const [desiredFeature, setDesiredFeature] = useState('')
  const [needsImprovement, setNeedsImprovement] = useState('')
  const [contactConsent, setContactConsent] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = useAuthStore((s) => s.user?.id)
  const markFeedbackEngagement = useFeatureVotesStore((s) => s.markFeedbackEngagement)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating === 0) return

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
        <div className="px-5 py-4">
          <div className="text-center py-12 animate-fadeInScale">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-themegreen/10 mb-4">
              <CheckCircle size={32} className="text-themegreen" />
            </div>
            <h2 className="text-xl font-semibold text-primary mb-2">Thank You!</h2>
            <p className="text-primary">
              Your feedback has been submitted. We appreciate your input!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-4">

        <p className="text-xs text-primary leading-relaxed px-1">
          Help us improve by sharing your experience and suggestions.
        </p>

        {error && <ErrorDisplay message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Rating card */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-3">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">
              How would you rate your experience?
            </span>
            <div className="flex gap-1.5 mt-1.5">
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
          </div>

          {/* Details card */}
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden px-4 py-3">
            <div className="space-y-3">

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

              {/* Comments */}
              <div>
                <span className="block text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-1">
                  Additional comments
                </span>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Share your thoughts..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-2xl text-sm bg-themewhite dark:bg-themewhite3 text-primary
                           border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2
                           focus:outline-none transition-all duration-300 placeholder:text-tertiary resize-none"
                />
              </div>

              {/* Contact consent */}
              <label className="flex items-start gap-2.5 cursor-pointer pt-1 active:scale-[0.98] transition-transform select-none">
                <input
                  type="checkbox"
                  checked={contactConsent}
                  onChange={(e) => setContactConsent(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`relative w-5 h-5 shrink-0 mt-0.5 rounded border transition-colors duration-200 ${
                  contactConsent ? 'bg-themeblue3 border-themeblue3' : 'border-themeblue3/20 bg-themewhite'
                }`}>
                  {contactConsent && <Check size={14} className="absolute inset-0 m-auto text-white" />}
                </div>
                <span className="text-[9pt] text-primary leading-tight">
                  The developer can contact me regarding this feedback.
                </span>
              </label>

              {/* Submit */}
              <div className="flex items-center justify-end pt-1">
                <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-lg border border-tertiary/15">
                  <button
                    type="submit"
                    disabled={rating === 0 || submitting}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                  >
                    {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </form>

      </div>
    </div>
  )
}
