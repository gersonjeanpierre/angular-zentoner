export const splitNamesForDisplayFitText = (firstName: string, lastName: string) => {
  let displayFitText = firstName.split(' ')[0];
  if (lastName) {
    displayFitText += ' ' + lastName.split(' ')[0];
  }
  return displayFitText;
};
