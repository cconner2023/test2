import { useState } from 'react'
import { Star, CheckCircle } from 'lucide-react'
import { submitFeedback } from '../../lib/feedbackService'

export const FeedbackPanel = () => {
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')
  const [mostUseful, setMostUseful] = useState('')
  const [desiredFeature, setDesiredFeature] = useState('')
  const [needsImprovement, setNeedsImprovement] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setSubmitted(true)
    } else {
      setError(result.error || 'Failed to submit feedback')
    }
  }

  if (submitted) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 md:p-5">
          <div className="text-center py-12 animate-fadeInScale">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-themegreen/10 mb-4">
              <CheckCircle size={32} className="text-themegreen" />
            </div>
            <h2 className="text-xl font-semibold text-primary mb-2">Thank You!</h2>
            <p className="text-tertiary/70">
              Your feedback has been submitted. We appreciate your input!
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <p className="text-sm text-tertiary/60 mb-5 md:text-base">
          Help us improve by sharing your experience and suggestions.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating */}
          <div>
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide block mb-2">
              How would you rate your experience?
            </span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 active:scale-90 transition-transform"
                  aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                >
                  <Star
                    size={32}
                    className={star <= rating ? 'text-themeblue3 fill-themeblue3' : 'text-themeblue3/20'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comments */}
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              Comments
            </span>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share your thoughts..."
              rows={3}
              className="mt-1 w-full px-4 py-2 rounded-2xl bg-themewhite text-tertiary text-[16px]
                       border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2
                       focus:outline-none transition-all placeholder:text-tertiary/30 resize-none"
            />
          </label>

          {/* Feature Questions */}
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              What feature do you find most useful?
            </span>
            <input
              type="text"
              value={mostUseful}
              onChange={(e) => setMostUseful(e.target.value)}
              placeholder="e.g. Algorithm navigation, clinic notes..."
              className="mt-1 w-full px-4 py-2 rounded-full bg-themewhite text-tertiary text-[16px]
                       border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2
                       focus:outline-none transition-all placeholder:text-tertiary/30"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              What feature would you most like to see added?
            </span>
            <input
              type="text"
              value={desiredFeature}
              onChange={(e) => setDesiredFeature(e.target.value)}
              placeholder="e.g. Offline mode, medication calculator..."
              className="mt-1 w-full px-4 py-2 rounded-full bg-themewhite text-tertiary text-[16px]
                       border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2
                       focus:outline-none transition-all placeholder:text-tertiary/30"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              What area needs the most improvement?
            </span>
            <input
              type="text"
              value={needsImprovement}
              onChange={(e) => setNeedsImprovement(e.target.value)}
              placeholder="e.g. Search, navigation, performance..."
              className="mt-1 w-full px-4 py-2 rounded-full bg-themewhite text-tertiary text-[16px]
                       border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2
                       focus:outline-none transition-all placeholder:text-tertiary/30"
            />
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={rating === 0 || submitting}
            className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium
                     hover:bg-themeblue2/90 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  )
}
