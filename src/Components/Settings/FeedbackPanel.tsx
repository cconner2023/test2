import { useState } from 'react'
import { Star, Check, CheckCircle, RefreshCw } from 'lucide-react'
import { submitFeedback } from '../../lib/feedbackService'
import { ErrorDisplay } from '../ErrorDisplay'
import { TextInput } from '../FormInputs'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFeatureVotesStore } from '../../stores/useFeatureVotesStore'
import { ActionPill } from '../ActionPill'

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

        <p className="text-[10pt] text-primary leading-relaxed px-1">
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
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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

            {/* Contact consent */}
            <label className="flex items-start gap-2.5 cursor-pointer px-4 py-3 border-b border-primary/6 active:scale-[0.98] transition-transform select-none">
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
            <div className="flex items-center justify-end gap-2 px-3 py-2">
              <button
                type="submit"
                disabled={submitting}
                className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 disabled:opacity-30 ${rating > 0 ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
              >
                {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  )
}
