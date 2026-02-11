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
                buttonClass: 'bg-themeredred/20 hover:bg-themeredred/30 text-primary',
                barBg: 'bg-gradient-to-r from-themeredred/5 to-themeredred/10 border border-themeredred/20',
                sliderClass: 'bg-themeredred',
                dispositionBadge: 'bg-themeredred/10 text-themeredred',
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
                buttonClass: 'bg-themeyellowlow/20 hover:bg-themeyellowlow/30 text-primary',
                barBg: 'bg-gradient-to-r from-themeyellowlow/5 to-themeyellowlow/10 border border-themeyellowlow/20',
                sliderClass: 'bg-themeyellowlow',
                dispositionBadge: 'bg-themeyellowlow/15 text-primary',
            };
        case 'CAT III':
            return {
                symptomCheck: 'text-themegreen',
                answerSlider: 'bg-themegreen',
                answerButton: 'text-white',
                badgeBg: 'bg-themegreen',
                badgeText: 'text-white',
                badgeBorder: 'border-themegreen/30',
                overlayBg: 'bg-themegreen',
                symptomClass: 'border-themegreen/60 bg-themegreen/10! text-primary',
                buttonClass: 'bg-themegreen/20 hover:bg-themegreen/30 text-primary',
                barBg: 'bg-gradient-to-r from-themegreen/5 to-themegreen/10 border border-themegreen/20',
                sliderClass: 'bg-themegreen',
                dispositionBadge: 'bg-themegreen/10 text-themegreen',
            };
        case 'CAT IV':
            return {
                symptomCheck: 'text-themeblue2',
                answerSlider: 'bg-themeblue2',
                answerButton: 'text-white',
                badgeBg: 'bg-themeblue2',
                badgeText: 'text-white',
                badgeBorder: 'border-themeblue2/30',
                overlayBg: 'bg-themeblue2',
                symptomClass: 'border-themeblue2/60 bg-themeblue2/10! text-primary',
                buttonClass: 'bg-themeblue2/20 hover:bg-themeblue2/30 text-primary',
                barBg: 'bg-gradient-to-r from-themeblue2/5 to-themeblue2/10 border border-themeblue2/20',
                sliderClass: 'bg-themeblue2',
                dispositionBadge: 'bg-themeblue2/10 text-themeblue2',
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
                dispositionBadge: 'bg-themeblue3/10 text-themeblue3',
            };
        default:
            return {
                symptomCheck: 'text-themeblue3',
                answerSlider: 'bg-themeblue3',
                answerButton: 'text-white',
                badgeBg: 'bg-themeblue3',
                badgeText: 'text-white',
                badgeBorder: 'border-themeblue1/30',
                overlayBg: 'bg-themeblue3',
                symptomClass: 'border-themeblue3/20 text-primary bg-themeblue3/10!',
                buttonClass: 'bg-themeblue3/20 hover:bg-themeblue3/30 text-white',
                barBg: 'bg-gradient-to-r from-themeblue3/5 to-themeblue3/10 border border-themeblue3/20',
                sliderClass: 'bg-themeblue3',
                dispositionBadge: 'bg-themeblue3/10 text-themeblue3',
            };
    }
};