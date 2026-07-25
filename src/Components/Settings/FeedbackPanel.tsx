import { useState, useRef } from 'react'
import { Star, Check, CheckCircle, RefreshCw, ImagePlus, X } from 'lucide-react'
import { submitFeedback } from '../../lib/feedbackService'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { TextInput, TextArea } from '@/Components/primitives/FormInputs'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFeatureVotesStore } from '../../stores/useFeatureVotesStore'

export const FeedbackPanel = () => {
  const [rating, setRating] = useState(0)
  const [comments, setComments] = useState('')
  const [mostUseful, setMostUseful] = useState('')
  const [desiredFeature, setDesiredFeature] = useState('')
  const [needsImprovement, setNeedsImprovement] = useState('')
  // Staged images as resized JPEG data URLs; encrypted + uploaded on submit.
  const [images, setImages] = useState<string[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = useAuthStore((s) => s.user?.id)
  const markFeedbackEngagement = useFeatureVotesStore((s) => s.markFeedbackEngagement)

  const MAX_IMAGES = 6
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-picking the same file
    if (!files.length) return
    const { resizeImage } = await import('../../Utilities/imageUtils')
    const picked = files.slice(0, MAX_IMAGES - images.length)
    const urls = await Promise.all(picked.map((f) => resizeImage(f, 1200, 0.7)))
    setImages((prev) => [...prev, ...urls])
  }

  const removeImage = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i))

  const hasContent =
    rating > 0 ||
    images.length > 0 ||
    [mostUseful, desiredFeature, needsImprovement, comments].some((v) => v.trim())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasContent) return

    setSubmitting(true)
    setError(null)

    const { dataUrlToBlob } = await import('../../Utilities/imageUtils')
    const result = await submitFeedback({
      rating,
      comments: comments || null,
      most_useful_feature: mostUseful || null,
      desired_feature: desiredFeature || null,
      needs_improvement: needsImprovement || null,
      imageBlobs: images.map(dataUrlToBlob),
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

            <TextArea
              value={comments}
              onChange={setComments}
              placeholder="Additional comments"
              rows={3}
            />

            {/* Images — optional screenshots/photos to illustrate the feedback.
                Encrypted client-side and uploaded on submit. */}
            <div className="px-4 py-3 border-b border-primary/6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePickImages}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10pt] text-secondary">
                  Photos{images.length > 0 ? ` · ${images.length}` : ''}
                </span>
                {images.length < MAX_IMAGES && (
                  <ActionButton
                    icon={ImagePlus}
                    label="Add photos"
                    onClick={() => fileInputRef.current?.click()}
                  />
                )}
              </div>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {images.map((src, i) => (
                    <div key={i} className="relative w-16 h-16">
                      <img
                        src={src}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover border border-tertiary/15"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        aria-label="Remove image"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center active:scale-95"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
