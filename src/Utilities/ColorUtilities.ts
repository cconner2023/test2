import type { dispositionType } from '../Types/AlgorithmTypes';
export const getColorClasses = (type?: dispositionType['type']) => {
    switch (type) {
        case 'CAT I':
            return {
                symptomCheck: 'text-themeredred',
                answerSlider: 'bg-themeredred',
                answerButton: 'text-primary',
                badgeBg: 'bg-themeredred',
                badgeText: 'text-primary',
                badgeBorder: 'border-themeredred/30',
                overlayBg: 'bg-themeredred',
                symptomClass: 'border-themeredred/60 bg-themeredred/10! text-primary',
                buttonClass: 'bg-themeredred/20 hover:bg-themeredred/30 text-themeredred',
                barBg: 'bg-gradient-to-r from-themeredred/5 to-themeredred/10 border border-themeredred/20',
                sliderClass: 'bg-themeredred',
            };
        case 'CAT II':
            return {
                symptomCheck: 'text-themeyellow',
                answerSlider: 'bg-themeyellowlow',
                answerButton: 'text-black',
                badgeBg: 'bg-themeyellowlow',
                badgeText: 'text-black',
                badgeBorder: 'border-themeyellowlow/30',
                overlayBg: 'bg-themeyellowlow',
                symptomClass: 'border-themeyellowlow/60 bg-themeyellowlow/20 text-primary',
                buttonClass: 'bg-themeyellowlow/20 hover:bg-themeyellowlow/30 text-themeyellowlow',
                barBg: 'bg-gradient-to-r from-themeyellowlow/5 to-themeyellowlow/10 border border-themeyellowlow/20',
                sliderClass: 'bg-themeyellowlow',
            };
        case 'OTHER':
            return {
                symptomCheck: 'text-themeblue3',
                answerSlider: 'bg-themeblue3',
                answerButton: 'text-themewhite',
                badgeBg: 'bg-themeblue3',
                badgeText: 'text-themewhite',
                badgeBorder: 'border-themeblue1/30',
                overlayBg: 'bg-themeblue3',
                symptomClass: 'border-themeblue3/20 text-primary bg-themeblue3/10!',
                buttonClass: 'bg-themeblue3/20 hover:bg-themeblue3/30 text-themeblue3',
                barBg: 'bg-gradient-to-r from-themeblue3/5 to-themeblue3/10 border border-themeblue3/20',
                sliderClass: 'bg-themeblue3',
            };
        default:
            return {
                symptomCheck: 'text-themeblue3',
                answerSlider: 'bg-themeblue3',
                answerButton: 'text-themewhite',
                badgeBg: 'bg-themeblue3',
                badgeText: 'text-themewhite',
                badgeBorder: 'border-themeblue1/30',
                overlayBg: 'bg-themeblue3',
                symptomClass: 'border-themeblue3/20 text-primary bg-themeblue3/10!',
                buttonClass: 'bg-themeblue3/20 hover:bg-themeblue3/30 text-themeblue3',
                barBg: 'bg-gradient-to-r from-themeblue3/5 to-themeblue3/10 border border-themeblue3/20',
                sliderClass: 'bg-themeblue3',
            };
    }
};